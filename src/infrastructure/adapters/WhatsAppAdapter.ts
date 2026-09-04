import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import * as fs from 'fs';
import { Boom } from '@hapi/boom';
import { DecisionEngine, FlowProvider } from 'motor-decision';
import { SessionLeadManager } from '../../application/SessionLeadManager';
import { SessionIdGenerator } from '../utils/SessionIdGenerator';
import { LeadRepository } from '../../domain/LeadRepository';
import { ErrorHandler } from '../logging/ErrorHandler';

import { AuthStorageAdapter } from '../../domain/AuthStorageAdapter';
import { AuthStorageFactory } from './auth/AuthStorageFactory';
import { DecisionTreeManager } from '../../application/DecisionTreeManager';
import { SessionConfig } from '../../config/config';

export type ConnectionStatus = 'DISCONNECTED' | 'WAITING_QR' | 'CONNECTED';

// Interfaz para mantener el estado de la conversación activa por usuario
export interface ActiveSession {
  sessionId: string; // El ID generado con MAC y Timestamp
  engine: DecisionEngine;
  flowId: string;
  lastActivityAt: number; // Timestamp en ms
  isHumanMode?: boolean; // Indica si un ASESOR intervino manualmente
  humanModeStartedAt?: number; // Timestamp en ms cuando el ASESOR tomó el control
}

export class WhatsAppAdapter {
  private activeSessions = new Map<string, ActiveSession>(); // remoteJid -> Session
  private botSentMessageIds = new Set<string>(); // IDs de mensajes enviados por el bot para diferenciar del ASESOR
  private leadManager: SessionLeadManager;
  private flowProvider: FlowProvider;
  private authStorage: AuthStorageAdapter;
  private flowManager?: DecisionTreeManager;
  private sessionConfig: SessionConfig;
  private timeoutTimer: any = null;

  private lidMap = new Map<string, string>();

  private currentSock: any = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  private currentQr: string | null = null;
  private connectedUser: string | null = null;

  constructor(
    flowProvider: FlowProvider,
    leadRepo: LeadRepository,
    authStorage?: AuthStorageAdapter,
    flowManager?: DecisionTreeManager,
    sessionConfig?: SessionConfig
  ) {
    this.leadManager = new SessionLeadManager(leadRepo);
    this.flowProvider = flowProvider;
    this.authStorage = authStorage || AuthStorageFactory.create();
    this.flowManager = flowManager;
    this.sessionConfig = sessionConfig || { timeoutMinutes: 15, defaultFlowId: 'flow_cfp412' };

    this.startTimeoutChecker();
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getQR(): string | null {
    return this.currentQr;
  }

  public getConnectedUser(): string | null {
    return this.connectedUser;
  }

  public updateSessionConfig(config: SessionConfig): void {
    this.sessionConfig = { ...this.sessionConfig, ...config };
  }

  public getSessionConfig(): SessionConfig {
    return this.sessionConfig;
  }

  public getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  public getActiveSessionsMap(): Map<string, ActiveSession> {
    return this.activeSessions;
  }

  public setHumanMode(remoteJid: string, isHumanMode: boolean): boolean {
    const session = this.activeSessions.get(remoteJid);
    if (!session) return false;
    session.isHumanMode = isHumanMode;
    if (isHumanMode) {
      session.humanModeStartedAt = Date.now();
    }
    session.lastActivityAt = Date.now();
    return true;
  }

  public async sendBotMessage(sock: any, jid: string, content: any, options?: any): Promise<any> {
    if (!sock) return null;
    try {
      const result = options !== undefined
        ? await sock.sendMessage(jid, content, options)
        : await sock.sendMessage(jid, content);
      if (result && result.key && result.key.id) {
        this.botSentMessageIds.add(result.key.id);
        setTimeout(() => {
          this.botSentMessageIds.delete(result.key.id);
        }, 60000);
      }
      return result;
    } catch (err) {
      throw err;
    }
  }

  public startTimeoutChecker(): void {
    if (this.timeoutTimer) return;
    this.timeoutTimer = setInterval(() => {
      this.checkSessionTimeouts().catch((err) => {
        ErrorHandler.handle('WhatsAppAdapter', err);
      });
    }, 30000);
  }

  public stopTimeoutChecker(): void {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  public async checkSessionTimeouts(): Promise<void> {
    const timeoutMinutes = this.sessionConfig?.timeoutMinutes || 15;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const humanTimeoutMinutes = this.sessionConfig?.humanModeTimeoutMinutes || 30;
    const humanTimeoutMs = humanTimeoutMinutes * 60 * 1000;
    const now = Date.now();

    for (const [remoteJid, session] of Array.from(this.activeSessions.entries())) {
      // Si está en Modo Asesor y superó el timeout de inactividad humana
      if (session.isHumanMode && now - session.lastActivityAt >= humanTimeoutMs) {
        session.isHumanMode = false;
        ErrorHandler.logSystem('WhatsAppAdapter', `Modo Asesor despausado automáticamente por inactividad (${humanTimeoutMinutes} min) para ${remoteJid}`);
      }

      if (now - session.lastActivityAt >= timeoutMs) {
        ErrorHandler.logSystem('WhatsAppAdapter', `Sesión ${session.sessionId} para ${remoteJid} expiró por inactividad (${timeoutMinutes} min). Cerrando...`);

        await this.leadManager.finalizeSession(session.sessionId);
        this.activeSessions.delete(remoteJid);

        if (this.currentSock && this.status === 'CONNECTED') {
          try {
            await this.sendBotMessage(this.currentSock, remoteJid, {
              text: "⚠️ La conversación se ha cerrado automáticamente por inactividad. ¡Escríbenos de nuevo cuando desees volver a comenzar!"
            });
          } catch (e: any) {
            ErrorHandler.logSystem('WhatsAppAdapter', `No se pudo enviar mensaje de cierre por inactividad a ${remoteJid}: ${e.message}`);
          }
        }
      }
    }
  }

  public getFlowIdForPhone(_remoteJid: string): string {
    if (this.sessionConfig?.defaultFlowId) return this.sessionConfig.defaultFlowId;
    if (this.flowManager) return this.flowManager.getDefaultFlowId();
    return 'flow_cfp412';
  }

  public async resetAccount(): Promise<void> {
    ErrorHandler.logSystem('WhatsAppAdapter', 'Iniciando reseteo manual de cuenta de WhatsApp desde panel web...');
    this.status = 'DISCONNECTED';
    this.currentQr = null;
    this.connectedUser = null;
    this.activeSessions.clear();

    if (this.currentSock) {
      try {
        if (this.currentSock.ev) {
          this.currentSock.ev.removeAllListeners('connection.update');
          this.currentSock.ev.removeAllListeners('messages.upsert');
          this.currentSock.ev.removeAllListeners('creds.update');
        }
        if (typeof this.currentSock.end === 'function') {
          this.currentSock.end(undefined);
        }
      } catch (err: any) {
        ErrorHandler.logSystem('WhatsAppAdapter', `Aviso al cerrar socket previo: ${err.message}`);
      }
      this.currentSock = null;
    }

    await this.authStorage.clearAuth();
    ErrorHandler.logSystem('WhatsAppAdapter', 'Credenciales limpiadas exitosamente. Iniciando reconexión limpia...');

    await this.start();
  }

  private async resolveJid(sock: any, msg: any): Promise<string> {
    const key = msg.key || {};
    const rawJid = key.remoteJid || '';

    if (!rawJid || rawJid.endsWith('@s.whatsapp.net')) {
      return rawJid;
    }

    if (!rawJid.endsWith('@lid')) {
      return rawJid;
    }

    if (key.senderPn && typeof key.senderPn === 'string') {
      const cleanPn = key.senderPn.replace(/@.*$/, '');
      const pnJid = `${cleanPn}@s.whatsapp.net`;
      this.lidMap.set(rawJid, pnJid);
      return pnJid;
    }

    if (key.remoteJidAlt && typeof key.remoteJidAlt === 'string') {
      let pnJid = key.remoteJidAlt;
      if (!pnJid.endsWith('@s.whatsapp.net')) {
        const cleanPn = pnJid.replace(/@.*$/, '');
        pnJid = `${cleanPn}@s.whatsapp.net`;
      }
      this.lidMap.set(rawJid, pnJid);
      return pnJid;
    }

    const partAlt = key.participantAlt || msg.participantAlt;
    if (partAlt && typeof partAlt === 'string') {
      const cleanPn = partAlt.replace(/@.*$/, '');
      const pnJid = `${cleanPn}@s.whatsapp.net`;
      this.lidMap.set(rawJid, pnJid);
      return pnJid;
    }

    const part = key.participant || msg.participant;
    if (part && typeof part === 'string' && part.endsWith('@s.whatsapp.net')) {
      this.lidMap.set(rawJid, part);
      return part;
    }

    if (this.lidMap.has(rawJid)) {
      return this.lidMap.get(rawJid)!;
    }

    try {
      if (sock?.signalRepository?.lidMapping?.getPNForLID) {
        const pn = await sock.signalRepository.lidMapping.getPNForLID(rawJid);
        if (pn && typeof pn === 'string') {
          const cleanPn = pn.replace(/@.*$/, '');
          const pnJid = `${cleanPn}@s.whatsapp.net`;
          this.lidMap.set(rawJid, pnJid);
          return pnJid;
        }
      }
    } catch {
      // Ignorar si no está implementado
    }

    return rawJid;
  }

  private extractMessageText(messageContent: any): string {
    if (!messageContent) return "";
    const content = messageContent.ephemeralMessage?.message || messageContent;

    return (
      content.conversation ||
      content.extendedTextMessage?.text ||
      content.buttonsResponseMessage?.selectedButtonId ||
      content.templateButtonReplyMessage?.selectedId ||
      content.listResponseMessage?.singleSelectReply?.selectedRowId ||
      content.imageMessage?.caption ||
      content.videoMessage?.caption ||
      content.documentMessage?.caption ||
      content.documentWithCaptionMessage?.message?.documentMessage?.caption ||
      ""
    );
  }

  async start() {
    await this.authStorage.beforeAuth();
    const { state, saveCreds } = await useMultiFileAuthState(this.authStorage.getAuthDir());
    
    const logger = pino({ level: 'silent' }) as any;

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger
    });

    this.currentSock = sock;

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      await this.authStorage.afterSaveCreds();
    });

    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        this.status = 'WAITING_QR';
        this.currentQr = qr;
        this.connectedUser = null;
        console.log('\n📱 Escanea el siguiente código QR con tu WhatsApp para conectar el Bot:\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        this.status = 'DISCONNECTED';
        this.currentQr = null;
        this.connectedUser = null;

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        ErrorHandler.logSystem('WhatsAppAdapter', `Conexión cerrada. Status: ${statusCode || 'desconocido'}. Reintentando conexión...`);
        
        if (isLoggedOut) {
          ErrorHandler.logSystem('WhatsAppAdapter', 'Sesión deslogueada o inválida. Limpiando credenciales locales para generar nuevo QR...');
          try {
            const authDir = this.authStorage.getAuthDir();
            if (fs.existsSync(authDir)) {
              fs.rmSync(authDir, { recursive: true, force: true });
              fs.mkdirSync(authDir, { recursive: true });
            }
          } catch (e: any) {
            ErrorHandler.logSystem('WhatsAppAdapter', `Error al limpiar authDir: ${e.message}`);
          }
        }
        
        setTimeout(() => {
          this.start().catch((err) => {
            ErrorHandler.handle('WhatsAppAdapter', err);
          });
        }, 2000);
      } else if (connection === 'open') {
        this.status = 'CONNECTED';
        this.currentQr = null;
        const userJid = sock.user?.id || sock.user?.jid || 'WhatsApp Dispositivo Vinculado';
        this.connectedUser = userJid;
        console.log('\n✅ ¡Bot de WhatsApp conectado y listo para recibir mensajes!\n');
        ErrorHandler.logSystem('WhatsAppAdapter', `Conexión establecida con éxito. Dispositivo: ${userJid}`);
      }
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      if (m.type !== 'notify') return;

      const msg = m.messages[0];
      if (!msg || !msg.message || !msg.key.remoteJid) return;

      const rawJid = msg.key.remoteJid;
      if (rawJid.endsWith('@g.us') || rawJid.endsWith('@newsletter') || rawJid === 'status@broadcast') {
        return;
      }

      // 1. Mensajes enviados desde nuestra propia cuenta (fromMe: true)
      if (msg.key.fromMe) {
        // Si el mensaje fue generado programáticamente por el bot, ignorar
        if (msg.key.id && this.botSentMessageIds.has(msg.key.id)) {
          return;
        }

        // Si NO fue generado por el bot, se trata de un ASESOR humano respondiendo desde WhatsApp Business
        const messageContent = msg.message.ephemeralMessage?.message || msg.message;
        if (messageContent.reactionMessage || messageContent.protocolMessage || messageContent.pollUpdateMessage) {
          return;
        }

        const text = this.extractMessageText(messageContent).trim();
        const remoteJid = await this.resolveJid(sock, msg);

        const cleanText = text.toLowerCase();
        if (cleanText === '#bot' || cleanText === '#reanudar' || cleanText === '#menu') {
          const session = this.activeSessions.get(remoteJid);
          if (session) {
            session.isHumanMode = false;
            session.lastActivityAt = Date.now();
            ErrorHandler.logSystem('WhatsAppAdapter', `[ASESOR] Asesor reactivó el bot para ${remoteJid} con comando '${text}'`);
            await this.sendBotMessage(sock, remoteJid, { text: "🤖 Automatización reactivada por el Asesor." });
          }
          return;
        }

        // Marcar o crear sesión en Modo Asesor (isHumanMode = true)
        let session = this.activeSessions.get(remoteJid);
        if (!session) {
          const sessionId = SessionIdGenerator.generate(remoteJid);
          const flowId = this.getFlowIdForPhone(remoteJid);
          let engine: DecisionEngine;
          if (this.flowManager) {
            try {
              engine = this.flowManager.createEngine(flowId);
            } catch (_err) {
              engine = new DecisionEngine(this.flowProvider.getFlow(), this.flowProvider.getInitialNodeId());
            }
          } else {
            engine = new DecisionEngine(this.flowProvider.getFlow(), this.flowProvider.getInitialNodeId());
          }
          session = {
            sessionId,
            engine,
            flowId,
            lastActivityAt: Date.now(),
            isHumanMode: true,
            humanModeStartedAt: Date.now()
          };
          this.activeSessions.set(remoteJid, session);
        } else {
          session.isHumanMode = true;
          session.humanModeStartedAt = Date.now();
          session.lastActivityAt = Date.now();
        }

        ErrorHandler.logSystem('WhatsAppAdapter', `[ASESOR] Intervención detectada en chat ${remoteJid}: "${text}". Automatización pausada (isHumanMode = true).`);
        return;
      }

      // 2. Mensajes entrantes del CLIENTE (fromMe: false)
      const messageContent = msg.message.ephemeralMessage?.message || msg.message;

      // Ignorar mensajes de sistema/protocolo, reacciones o encuestas
      if (messageContent.reactionMessage || messageContent.protocolMessage || messageContent.pollUpdateMessage) {
        return;
      }

      const text = this.extractMessageText(messageContent);
      const remoteJid = await this.resolveJid(sock, msg);

      if (rawJid !== remoteJid) {
        ErrorHandler.logSystem('WhatsAppAdapter', `JID LID detectado (${rawJid}), normalizado a ${remoteJid}`);
      }

      ErrorHandler.logSystem('WhatsAppAdapter', `Mensaje recibido de ${remoteJid}: "${text.trim()}"`);

      try {
        await this.processMessage(sock, remoteJid, text.trim(), msg);
      } catch (err) {
        ErrorHandler.handle('WhatsAppAdapter', err, { remoteJid, rawJid, text: text.trim() });
      }
    });
  }

  private async processMessage(sock: any, remoteJid: string, text: string, rawMsg?: any) {
    const sendOptions = rawMsg ? { quoted: rawMsg } : {};
    const targetJid = (typeof rawMsg?.key?.remoteJid === 'string' && rawMsg.key.remoteJid) ? rawMsg.key.remoteJid : remoteJid;

    // 1. Obtener o crear la sesión activa para este usuario
    if (!this.activeSessions.has(remoteJid)) {
      const sessionId = SessionIdGenerator.generate(remoteJid);
      const flowId = this.getFlowIdForPhone(remoteJid);
      ErrorHandler.logSystem('WhatsAppAdapter', `Nueva sesión iniciada: ${sessionId} para ${remoteJid} usando flujo '${flowId}'`);
      
      let engine: DecisionEngine;
      if (this.flowManager) {
        try {
          engine = this.flowManager.createEngine(flowId);
        } catch (_err) {
          engine = new DecisionEngine(this.flowProvider.getFlow(), this.flowProvider.getInitialNodeId());
        }
      } else {
        engine = new DecisionEngine(this.flowProvider.getFlow(), this.flowProvider.getInitialNodeId());
      }

      this.activeSessions.set(remoteJid, {
        sessionId: sessionId,
        engine: engine,
        flowId: flowId,
        lastActivityAt: Date.now()
      });

      const isPhoneNumber = remoteJid.endsWith('@s.whatsapp.net');
      if (isPhoneNumber) {
        const rawPhone = remoteJid.split('@')[0];
        this.leadManager.initSession(sessionId, {
          Telefono_WhatsApp: rawPhone
        });
      } else {
        this.leadManager.initSession(sessionId);
      }

      const initialNode = engine.getCurrentNode();
      ErrorHandler.logSystem('WhatsAppAdapter', `Enviando menú inicial a ${targetJid} (Nodo: ${initialNode.id})`);
      await this.sendBotMessage(sock, targetJid, { text: initialNode.text }, sendOptions);
      return;
    }

    const session = this.activeSessions.get(remoteJid)!;
    session.lastActivityAt = Date.now();
    
    // Si la sesión está en Modo Asesor (intervención humana)
    if (session.isHumanMode) {
      const cleanText = text.toLowerCase();
      // Si el cliente envía comando de menú o reactivación explícita
      if (cleanText === '#bot' || cleanText === 'menu' || cleanText === 'bot') {
        session.isHumanMode = false;
        ErrorHandler.logSystem('WhatsAppAdapter', `CLIENTE ${remoteJid} solicitó reactivar el bot con comando '${text}'. Reanudando automatización...`);
      } else {
        ErrorHandler.logSystem('WhatsAppAdapter', `[Modo Asesor] Mensaje de CLIENTE ${remoteJid} omitido por atención humana de ASESOR: "${text}"`);
        return; // No enviar respuesta automática
      }
    }

    if (text.toLowerCase() === 'salir' || text.toLowerCase() === 'menu') {
      await this.leadManager.finalizeSession(session.sessionId);
      this.activeSessions.delete(remoteJid);
      ErrorHandler.logSystem('WhatsAppAdapter', `Sesión finalizada manualmente por usuario ${remoteJid}`);
      await this.sendBotMessage(sock, targetJid, { text: "Conversación finalizada. ¡Escríbenos de nuevo para volver a empezar!" }, sendOptions);
      return;
    }

    const currentNode = session.engine.getCurrentNode();
    if (currentNode.extractData) {
      const validationError = this.leadManager.validateField(currentNode.extractData, text);
      if (validationError) {
        ErrorHandler.logSystem('WhatsAppAdapter', `Validación fallida para ${remoteJid} (Campo: ${currentNode.extractData}): "${text}"`);
        await this.sendBotMessage(sock, targetJid, { text: `⚠️ ${validationError}\n\n${currentNode.text}` }, sendOptions);
        return;
      }
    }

    // 2. Procesar la respuesta con el motor
    const { nextNode, extractedData, error } = session.engine.processAnswer(text);

    if (nextNode) {
      if (extractedData) {
        this.leadManager.addData(session.sessionId, extractedData.key, extractedData.value);
      }

      let targetNode = nextNode;
      const visitedNodes = new Set<string>();

      const isAutoCompletable = (field: string) => {
        return field !== 'Opcion_Elegida' && field !== 'Accion_Reinicio';
      };

      while (
        targetNode && 
        targetNode.extractData && 
        isAutoCompletable(targetNode.extractData) &&
        !visitedNodes.has(targetNode.id) &&
        this.leadManager.hasValidField(session.sessionId, targetNode.extractData)
      ) {
        visitedNodes.add(targetNode.id);

        const autoVal = this.leadManager.getSessionData(session.sessionId, targetNode.extractData)!;
        ErrorHandler.logSystem('WhatsAppAdapter', `Auto-completando '${targetNode.extractData}' para ${remoteJid} con valor: "${autoVal}"`);
        this.leadManager.addData(session.sessionId, targetNode.extractData, autoVal);

        const autoResult = session.engine.processAnswer(autoVal);
        if (!autoResult.nextNode) break;
        targetNode = autoResult.nextNode;
      }

      ErrorHandler.logSystem('WhatsAppAdapter', `Enviando respuesta a ${targetJid} (Nodo: ${targetNode.id})`);
      await this.sendBotMessage(sock, targetJid, { text: targetNode.text }, sendOptions);

      if (targetNode.id.includes("FIN") || targetNode.id.includes("CIERRE")) {
        ErrorHandler.logSystem('WhatsAppAdapter', `Fin de flujo alcanzado para ${session.sessionId}. Guardando Lead...`);
        await this.leadManager.finalizeSession(session.sessionId);
        this.activeSessions.delete(remoteJid);
      }
    } else {
      const currentNode = session.engine.getCurrentNode();
      ErrorHandler.logSystem('WhatsAppAdapter', `Opción no válida enviada por ${remoteJid}: "${text}". ${error || ''}. Reenviando nodo actual.`);
      await this.sendBotMessage(sock, targetJid, { text: `Opción no válida.\n\n${currentNode.text}` }, sendOptions);
    }
  }
}
