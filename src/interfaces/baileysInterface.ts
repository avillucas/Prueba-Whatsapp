import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { DecisionEngine, DecisionNode } from 'motor-decision';
import { AppConfig } from '../config';
import { saveLead } from '../storage/csvAdapter';

export async function startBaileysInterface(config: AppConfig, nodes: DecisionNode[]) {
    const sessions = new Map<string, DecisionEngine>();

    async function connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }) as any
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('Escanea el siguiente código QR con tu WhatsApp:');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Conexión cerrada. Razón:', lastDisconnect?.error, '¿Reconectar?', shouldReconnect);
                
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                console.log('¡Conectado exitosamente a WhatsApp!');
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            
            if (!msg.message || msg.key.fromMe) return;

            const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

            if (textMessage) {
                console.log(`Mensaje recibido de ${msg.key.remoteJid}: ${textMessage}`);
                
                const remoteJid = msg.key.remoteJid!;
                if (!sessions.has(remoteJid)) {
                    sessions.set(remoteJid, new DecisionEngine(nodes, "MSG_INICIAL"));
                    const engine = sessions.get(remoteJid)!;
                    const currentNode = engine.getCurrentNode();
                    await sock.sendMessage(remoteJid, { text: currentNode.text });
                    return;
                }

                const engine = sessions.get(remoteJid)!;
                const { nextNode, extractedData, error } = engine.processAnswer(textMessage.trim());

                if (nextNode) {
                    if (extractedData) {
                        console.log(`[Dato extraído] ${extractedData.key}: ${extractedData.value}`);
                        saveLead(config, remoteJid, extractedData.key, extractedData.value);
                    }
                    await sock.sendMessage(remoteJid, { text: nextNode.text });
                } else {
                    await sock.sendMessage(remoteJid, { text: `⚠️ Opción no válida.\n\n${engine.getCurrentNode().text}` });
                }
            }
        });
    }

    connectToWhatsApp();
}
