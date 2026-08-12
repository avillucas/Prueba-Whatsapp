import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { DecisionEngine } from 'motor-decision';
import { cfp412Mockup } from 'motor-decision/dist/data/cfp412Mockup';

const sessions = new Map<string, DecisionEngine>();

async function connectToWhatsApp() {
    // Implementamos useMultiFileAuthState para persistir la sesión en la carpeta auth_info
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // Inicializamos el socket
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Lo manejamos manualmente para usar qrcode-terminal
        logger: pino({ level: 'silent' }) as any // Silenciamos logs innecesarios para ver bien el QR
    });

    // Evento para guardar las credenciales cuando cambian
    sock.ev.on('creds.update', saveCreds);

    // Manejo de eventos de conexión (QR, reconexión, conexión exitosa)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Mostramos el QR en la terminal si se requiere vinculación
            console.log('Escanea el siguiente código QR con tu WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. Razón:', lastDisconnect?.error, '¿Reconectar?', shouldReconnect);
            
            // Reconectamos si no fue un cierre de sesión explícito
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('¡Conectado exitosamente a WhatsApp!');
        }
    });

    // Escuchamos los mensajes entrantes
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        
        // Ignoramos si el mensaje no tiene texto o si fue enviado por nosotros mismos
        if (!msg.message || msg.key.fromMe) return;

        // Obtenemos el texto del mensaje (puede venir en diferentes formatos según si es texto plano o extendido)
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (textMessage) {
            console.log(`Mensaje recibido de ${msg.key.remoteJid}: ${textMessage}`);
            
            const remoteJid = msg.key.remoteJid!;
            if (!sessions.has(remoteJid)) {
                sessions.set(remoteJid, new DecisionEngine(cfp412Mockup, "MSG_INICIAL"));
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
                }
                await sock.sendMessage(remoteJid, { text: nextNode.text });
            } else {
                await sock.sendMessage(remoteJid, { text: `⚠️ Opción no válida.\n\n${engine.getCurrentNode().text}` });
            }
        }
    });
}

// Iniciamos la conexión
connectToWhatsApp();
