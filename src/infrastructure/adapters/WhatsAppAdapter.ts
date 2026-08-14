import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { DecisionEngine, FlowProvider } from 'motor-decision';
import { SessionLeadManager } from '../../application/SessionLeadManager';
import { SessionIdGenerator } from '../utils/SessionIdGenerator';
import { LeadRepository } from '../../domain/LeadRepository';
import { ErrorHandler } from '../logging/ErrorHandler';

// Interfaz para mantener el estado de la conversación activa por usuario
interface ActiveSession {
  sessionId: string; // El ID generado con MAC y Timestamp
  engine: DecisionEngine;
}

export class WhatsAppAdapter {
  private activeSessions = new Map<string, ActiveSession>(); // remoteJid -> Session
  private leadManager: SessionLeadManager;
  private flowProvider: FlowProvider;

  constructor(flowProvider: FlowProvider, leadRepo: LeadRepository) {
    this.leadManager = new SessionLeadManager(leadRepo);
    this.flowProvider = flowProvider;
  }

  async start() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    // Configuramos pino logger para evitar que ensucie la consola
    const logger = pino({ level: 'silent' }) as any;

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 Escanea el siguiente código QR con tu WhatsApp para conectar el Bot:\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        ErrorHandler.logSystem('WhatsAppAdapter', `Conexión cerrada. Reconectando: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          this.start();
        } else {
          ErrorHandler.logSystem('WhatsAppAdapter', 'Sesión deslogueada. Borra la carpeta auth_info para escaneo de nuevo QR.');
        }
      } else if (connection === 'open') {
        console.log('\n✅ ¡Bot de WhatsApp conectado y listo para recibir mensajes!\n');
        ErrorHandler.logSystem('WhatsAppAdapter', 'Conexión establecida con éxito.');
      }
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      if (m.type !== 'notify') return;

      const msg = m.messages[0];
      if (!msg || !msg.message || msg.key.fromMe || !msg.key.remoteJid) return;

      const remoteJid = msg.key.remoteJid;
      if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@newsletter') || remoteJid === 'status@broadcast') {
        return;
      }

      const messageContent = msg.message.ephemeralMessage?.message || msg.message;
      const text = messageContent.conversation || 
                   messageContent.extendedTextMessage?.text || 
                   messageContent.buttonsResponseMessage?.selectedButtonId || 
                   "";

      if (!text.trim()) return;

      ErrorHandler.logSystem('WhatsAppAdapter', `Mensaje recibido de ${remoteJid}: "${text.trim()}"`);

      try {
        await this.processMessage(sock, remoteJid, text.trim());
      } catch (err) {
        ErrorHandler.handle('WhatsAppAdapter', err, { remoteJid, text: text.trim() });
      }
    });
  }

  private async processMessage(sock: any, remoteJid: string, text: string) {
    // 1. Obtener o crear la sesión activa para este usuario
    if (!this.activeSessions.has(remoteJid)) {
      const sessionId = SessionIdGenerator.generate(remoteJid);
      ErrorHandler.logSystem('WhatsAppAdapter', `Nueva sesión iniciada: ${sessionId} para ${remoteJid}`);
      
      const engine = new DecisionEngine(this.flowProvider.getFlow(), this.flowProvider.getInitialNodeId());
      this.activeSessions.set(remoteJid, {
        sessionId: sessionId,
        engine: engine
      });

      const rawPhone = remoteJid.split('@')[0];
      this.leadManager.initSession(sessionId, {
        Telefono_WhatsApp: rawPhone
      });

      const initialNode = engine.getCurrentNode();
      ErrorHandler.logSystem('WhatsAppAdapter', `Enviando menú inicial a ${remoteJid}`);
      await sock.sendMessage(remoteJid, { text: initialNode.text });
      return;
    }

    const session = this.activeSessions.get(remoteJid)!;
    
    if (text.toLowerCase() === 'salir' || text.toLowerCase() === 'menu') {
      await this.leadManager.finalizeSession(session.sessionId);
      this.activeSessions.delete(remoteJid);
      ErrorHandler.logSystem('WhatsAppAdapter', `Sesión finalizada manualmente por usuario ${remoteJid}`);
      await sock.sendMessage(remoteJid, { text: "Conversación finalizada. ¡Escríbenos de nuevo para volver a empezar!" });
      return;
    }

    const currentNode = session.engine.getCurrentNode();
    if (currentNode.extractData) {
      const validationError = this.leadManager.validateField(currentNode.extractData, text);
      if (validationError) {
        ErrorHandler.logSystem('WhatsAppAdapter', `Validación fallida para ${remoteJid} (Campo: ${currentNode.extractData}): "${text}"`);
        await sock.sendMessage(remoteJid, { text: `⚠️ ${validationError}\n\n${currentNode.text}` });
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

      while (targetNode && targetNode.extractData && this.leadManager.hasValidField(session.sessionId, targetNode.extractData)) {
        const autoVal = this.leadManager.getSessionData(session.sessionId, targetNode.extractData)!;
        ErrorHandler.logSystem('WhatsAppAdapter', `Auto-completando '${targetNode.extractData}' para ${remoteJid} con valor: "${autoVal}"`);
        this.leadManager.addData(session.sessionId, targetNode.extractData, autoVal);

        const autoResult = session.engine.processAnswer(autoVal);
        if (!autoResult.nextNode) break;
        targetNode = autoResult.nextNode;
      }

      ErrorHandler.logSystem('WhatsAppAdapter', `Enviando respuesta a ${remoteJid} (Nodo: ${targetNode.id})`);
      await sock.sendMessage(remoteJid, { text: targetNode.text });

      if (targetNode.id.includes("FIN") || targetNode.id.includes("CIERRE")) {
        ErrorHandler.logSystem('WhatsAppAdapter', `Fin de flujo alcanzado para ${session.sessionId}. Guardando Lead...`);
        await this.leadManager.finalizeSession(session.sessionId);
        this.activeSessions.delete(remoteJid);
      }
    } else {
      const currentNode = session.engine.getCurrentNode();
      ErrorHandler.logSystem('WhatsAppAdapter', `Opción no válida enviada por ${remoteJid}: "${text}". Reenviando nodo actual.`);
      if (error) {
        ErrorHandler.handle('WhatsAppAdapter', new Error(`Opción no válida: ${error}`), { remoteJid, text });
      }
      await sock.sendMessage(remoteJid, { text: `Opción no válida.\n\n${currentNode.text}` });
    }
  }
}
