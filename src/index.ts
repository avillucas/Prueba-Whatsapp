import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';

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
            
            // Respondemos al remitente
            await sock.sendMessage(msg.key.remoteJid!, { text: 'Hola Mundo!!!' });
        }
    });
}

// Iniciamos la conexión
connectToWhatsApp();
