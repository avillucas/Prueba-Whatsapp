import { WhatsAppAdapter } from '../../infrastructure/adapters/WhatsAppAdapter';
import { FlowProvider } from 'motor-decision';

let eventListeners: Record<string, any> = {};

const mockSock = {
  ev: {
    on: jest.fn((event: string, cb: any) => {
      eventListeners[event] = cb;
    })
  },
  sendMessage: jest.fn().mockResolvedValue(undefined)
};

jest.mock('@whiskeysockets/baileys', () => ({
  makeWASocket: jest.fn(() => mockSock),
  useMultiFileAuthState: jest.fn().mockResolvedValue({
    state: {},
    saveCreds: jest.fn()
  }),
  DisconnectReason: { loggedOut: 401 }
}));

jest.mock('qrcode-terminal', () => ({
  generate: jest.fn()
}));

describe("WhatsAppAdapter", () => {
  beforeEach(() => {
    eventListeners = {};
    jest.clearAllMocks();
  });

  const mockFlowProvider: FlowProvider = {
    getFlow: () => [
      {
        id: "MSG_INICIAL",
        text: "Menú Principal",
        options: [
          { match: "A", nextId: "NODE_NAME" }
        ]
      },
      {
        id: "NODE_NAME",
        text: "Ingrese Nombre",
        extractData: "Nombre_y_Apellido",
        options: [
          { match: "*", nextId: "NODE_TEL" }
        ]
      },
      {
        id: "NODE_TEL",
        text: "Ingrese Teléfono",
        extractData: "Telefono_WhatsApp",
        options: [
          { match: "*", nextId: "FIN" }
        ]
      },
      {
        id: "FIN",
        text: "¡Gracias!",
        options: []
      }
    ],
    getInitialNodeId: () => "MSG_INICIAL"
  };

  const mockRepo = {
    saveContacto: jest.fn().mockResolvedValue(undefined),
    saveListaEspera: jest.fn().mockResolvedValue(undefined)
  };

  it("Debería iniciar los listeners de Baileys y manejar conexión / QR", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    await adapter.start();

    expect(mockSock.ev.on).toHaveBeenCalledWith('connection.update', expect.any(Function));
    expect(mockSock.ev.on).toHaveBeenCalledWith('messages.upsert', expect.any(Function));

    // Simular QR
    eventListeners['connection.update']({ qr: 'mock_qr' });

    // Simular connection open
    eventListeners['connection.update']({ connection: 'open' });

    // Simular connection close (logged out)
    eventListeners['connection.update']({ connection: 'close', lastDisconnect: { error: { output: { statusCode: 401 } } } });
  });

  it("Debería ignorar mensajes no válidos o provenientes de grupos/estados", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    await adapter.start();

    const upsertHandler = eventListeners['messages.upsert'];

    // 1. Tipo no notify
    await upsertHandler({ type: 'append', messages: [] });

    // 2. Grupo
    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: '12345@g.us' }, message: { conversation: 'Hola' } }]
    });

    // 3. Status broadcast
    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: 'status@broadcast' }, message: { conversation: 'Hola' } }]
    });

    // 4. From me
    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: true, remoteJid: '5491135204878@s.whatsapp.net' }, message: { conversation: 'Hola' } }]
    });

    expect(mockSock.sendMessage).not.toHaveBeenCalled();
  });

  it("Debería procesar mensajes, autocompletar teléfono y avanzar automáticamente", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    await adapter.start();

    const upsertHandler = eventListeners['messages.upsert'];
    const userJid = "5491135204878@s.whatsapp.net";

    // 1. Enviar primer mensaje ("Hola") -> crea sesión e inicializa con teléfono autocompletado (+5491135204878)
    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: 'Hola' } }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "Menú Principal" });

    // 2. Enviar "A" -> pasa a NODE_NAME
    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: 'A' } }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "Ingrese Nombre" });

    // 3. Enviar Nombre ("Lucas Avila") -> Pasa por NODE_NAME, y luego el auto-avanzador detecta que NODE_TEL (Telefono_WhatsApp) YA está autocompletado, saltándolo hasta FIN!
    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: 'Lucas Avila' } }]
    });

    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "¡Gracias!" });
  });

  it("Debería manejar re-preguntas ante errores de validación", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    await adapter.start();

    const upsertHandler = eventListeners['messages.upsert'];
    const userJid = "5491135204879@s.whatsapp.net";

    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: 'Hola' } }]
    });

    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: 'A' } }]
    });

    // Enviar nombre inválido ("123")
    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: '123' } }]
    });

    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, expect.objectContaining({
      text: expect.stringContaining("⚠️")
    }));
  });

  it("Debería reiniciar la conversación si el usuario envía 'salir'", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    await adapter.start();

    const upsertHandler = eventListeners['messages.upsert'];
    const userJid = "5491135204880@s.whatsapp.net";

    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: 'Hola' } }]
    });

    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: 'salir' } }]
    });

    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "Conversación finalizada. ¡Escríbenos de nuevo para volver a empezar!" });
  });
});
