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

// Interfaz para mantener el estado de la conversación activa por usuario
interface ActiveSession {
  sessionId: string; // El ID generado con MAC y Timestamp
  engine: DecisionEngine;
}

export class WhatsAppAdapter {
  private activeSessions = new Map<string, ActiveSession>(); // remoteJid -> Session
  private leadManager: SessionLeadManager;
  private flowProvider: FlowProvider;
  private authStorage: AuthStorageAdapter;

  private lidMap = new Map<string, string>();

  constructor(flowProvider: FlowProvider, leadRepo: LeadRepository, authStorage?: AuthStorageAdapter) {
    this.leadManager = new SessionLeadManager(leadRepo);
    this.flowProvider = flowProvider;
    this.authStorage = authStorage || AuthStorageFactory.create();
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

    // 1. Buscar en senderPn (msg.key.senderPn)
    if (key.senderPn && typeof key.senderPn === 'string') {
      const cleanPn = key.senderPn.replace(/@.*$/, '');
      const pnJid = `${cleanPn}@s.whatsapp.net`;
      this.lidMap.set(rawJid, pnJid);
      return pnJid;
    }

    // 2. Buscar en remoteJidAlt (msg.key.remoteJidAlt)
    if (key.remoteJidAlt && typeof key.remoteJidAlt === 'string') {
      let pnJid = key.remoteJidAlt;
      if (!pnJid.endsWith('@s.whatsapp.net')) {
        const cleanPn = pnJid.replace(/@.*$/, '');
        pnJid = `${cleanPn}@s.whatsapp.net`;
      }
      this.lidMap.set(rawJid, pnJid);
      return pnJid;
    }

    // 3. Buscar en participantAlt (msg.key.participantAlt o msg.participantAlt)
    const partAlt = key.participantAlt || msg.participantAlt;
    if (partAlt && typeof partAlt === 'string') {
      const cleanPn = partAlt.replace(/@.*$/, '');
      const pnJid = `${cleanPn}@s.whatsapp.net`;
      this.lidMap.set(rawJid, pnJid);
      return pnJid;
    }

    // 4. Buscar en participant (msg.key.participant o msg.participant) si termina en @s.whatsapp.net
    const part = key.participant || msg.participant;
    if (part && typeof part === 'string' && part.endsWith('@s.whatsapp.net')) {
      this.lidMap.set(rawJid, part);
      return part;
    }

    // 5. Buscar en nuestro mapa de LID a PN acumulado en memoria
    if (this.lidMap.has(rawJid)) {
      return this.lidMap.get(rawJid)!;
    }

    // 6. Intentar resolver usando signalRepository.lidMapping de Baileys si está disponible
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

  async start() {
    await this.authStorage.beforeAuth();
    const { state, saveCreds } = await useMultiFileAuthState(this.authStorage.getAuthDir());
    
    // Configuramos pino logger para evitar que ensucie la consola
    const logger = pino({ level: 'silent' }) as any;

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger
    });

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      await this.authStorage.afterSaveCreds();
    });

    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 Escanea el siguiente código QR con tu WhatsApp para conectar el Bot:\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
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
        console.log('\n✅ ¡Bot de WhatsApp conectado y listo para recibir mensajes!\n');
        ErrorHandler.logSystem('WhatsAppAdapter', 'Conexión establecida con éxito.');
      }
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      if (m.type !== 'notify') return;

      const msg = m.messages[0];
      if (!msg || !msg.message || msg.key.fromMe || !msg.key.remoteJid) return;

      const rawJid = msg.key.remoteJid;
      if (rawJid.endsWith('@g.us') || rawJid.endsWith('@newsletter') || rawJid === 'status@broadcast') {
        return;
      }

      const messageContent = msg.message.ephemeralMessage?.message || msg.message;
      const text = messageContent.conversation || 
                   messageContent.extendedTextMessage?.text || 
                   messageContent.buttonsResponseMessage?.selectedButtonId || 
                   "";

      if (!text.trim()) return;

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
      ErrorHandler.logSystem('WhatsAppAdapter', `Nueva sesión iniciada: ${sessionId} para ${remoteJid}`);
      
      const engine = new DecisionEngine(this.flowProvider.getFlow(), this.flowProvider.getInitialNodeId());
      this.activeSessions.set(remoteJid, {
        sessionId: sessionId,
        engine: engine
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
      await sock.sendMessage(targetJid, { text: initialNode.text }, sendOptions);
      return;
    }

    const session = this.activeSessions.get(remoteJid)!;
    
    if (text.toLowerCase() === 'salir' || text.toLowerCase() === 'menu') {
      await this.leadManager.finalizeSession(session.sessionId);
      this.activeSessions.delete(remoteJid);
      ErrorHandler.logSystem('WhatsAppAdapter', `Sesión finalizada manualmente por usuario ${remoteJid}`);
      await sock.sendMessage(targetJid, { text: "Conversación finalizada. ¡Escríbenos de nuevo para volver a empezar!" }, sendOptions);
      return;
    }

    const currentNode = session.engine.getCurrentNode();
    if (currentNode.extractData) {
      const validationError = this.leadManager.validateField(currentNode.extractData, text);
      if (validationError) {
        ErrorHandler.logSystem('WhatsAppAdapter', `Validación fallida para ${remoteJid} (Campo: ${currentNode.extractData}): "${text}"`);
        await sock.sendMessage(targetJid, { text: `⚠️ ${validationError}\n\n${currentNode.text}` }, sendOptions);
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

      // No auto-completar selecciones de menú o acciones de navegación
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
      await sock.sendMessage(targetJid, { text: targetNode.text }, sendOptions);

      if (targetNode.id.includes("FIN") || targetNode.id.includes("CIERRE")) {
        ErrorHandler.logSystem('WhatsAppAdapter', `Fin de flujo alcanzado para ${session.sessionId}. Guardando Lead...`);
        await this.leadManager.finalizeSession(session.sessionId);
        this.activeSessions.delete(remoteJid);
      }
    } else {
      const currentNode = session.engine.getCurrentNode();
      ErrorHandler.logSystem('WhatsAppAdapter', `Opción no válida enviada por ${remoteJid}: "${text}". ${error || ''}. Reenviando nodo actual.`);
      await sock.sendMessage(targetJid, { text: `Opción no válida.\n\n${currentNode.text}` }, sendOptions);
    }
  }
}
