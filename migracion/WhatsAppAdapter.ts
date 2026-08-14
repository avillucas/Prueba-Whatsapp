import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { DecisionEngine } from '../domain/DecisionEngine';
import { SessionLeadManager } from './SessionLeadManager';
import { SessionIdGenerator } from './SessionIdGenerator';
import { FlowProvider } from '../domain/FlowProvider';
import { LeadRepository } from './LeadRepository';

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
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    
    // Configuramos pino logger para evitar que ensucie mucho la consola
    const logger = pino({ level: 'silent' }) as any;

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 Escanea el código QR superior con tu WhatsApp para conectar el Bot.\n');
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Conexión cerrada. ¿Reconectando?:', shouldReconnect);
        
        if (shouldReconnect) {
          this.start();
        } else {
          console.log('Te has deslogueado. Borra la carpeta auth_info_baileys para volver a escanear un QR.');
        }
      } else if (connection === 'open') {
        console.log('\n✅ ¡Bot de WhatsApp conectado y listo para recibir mensajes!\n');
      }
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      const msg = m.messages[0];
      
      // Ignoramos mensajes que enviamos nosotros mismos u otros estados
      if (!msg.message || msg.key.fromMe || !msg.key.remoteJid) return;

      const remoteJid = msg.key.remoteJid;
      // Extraemos el texto del mensaje dependiendo de si es texto plano o un mensaje extendido
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
      
      if (!text.trim()) return;

      await this.processMessage(sock, remoteJid, text.trim());
    });
  }

  private async processMessage(sock: any, remoteJid: string, text: string) {
    // 1. Obtener o crear la sesión activa para este usuario
    if (!this.activeSessions.has(remoteJid)) {
      const sessionId = SessionIdGenerator.generate(remoteJid);
      console.log(`[+] Nueva sesión iniciada: ${sessionId}`);
      
      this.activeSessions.set(remoteJid, {
        sessionId: sessionId,
        engine: new DecisionEngine(this.flowProvider.getFlow(), this.flowProvider.getInitialNodeId())
      });

      // Enviar el mensaje inicial sin necesidad de que el usuario haya acertado una opción
      const initialNode = this.activeSessions.get(remoteJid)!.engine.getCurrentNode();
      await sock.sendMessage(remoteJid, { text: initialNode.text });
      return;
    }

    const session = this.activeSessions.get(remoteJid)!;
    
    // Si el usuario envía la palabra de escape (ej. "salir" o "menu") podemos forzar un reset
    if (text.toLowerCase() === 'salir' || text.toLowerCase() === 'menu') {
      await this.leadManager.finalizeSession(session.sessionId);
      this.activeSessions.delete(remoteJid);
      await sock.sendMessage(remoteJid, { text: "Conversación finalizada. ¡Escríbenos de nuevo para volver a empezar!" });
      return;
    }

    // 2. Procesar la respuesta con el motor
    const { nextNode, extractedData, error } = session.engine.processAnswer(text);

    if (nextNode) {
      // Guardar datos si los hubo
      if (extractedData) {
        this.leadManager.addData(session.sessionId, extractedData.key, extractedData.value);
      }

      // Enviar la respuesta del bot
      await sock.sendMessage(remoteJid, { text: nextNode.text });

      // 3. Revisar si el flujo ha terminado
      if (nextNode.id.includes("FIN") || nextNode.id.includes("CIERRE")) {
        console.log(`[!] Fin de flujo para ${session.sessionId}. Guardando Lead...`);
        await this.leadManager.finalizeSession(session.sessionId);
        this.activeSessions.delete(remoteJid);
      }
    } else {
      // Si hubo un error (opción inválida), volver a enviar el texto del nodo actual
      const currentNode = session.engine.getCurrentNode();
      await sock.sendMessage(remoteJid, { text: `Opción no válida.\n\n${currentNode.text}` });
    }
  }
}
