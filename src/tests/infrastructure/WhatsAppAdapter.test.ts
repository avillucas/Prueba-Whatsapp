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
    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "Menú Principal" }, expect.anything());

    // 2. Enviar "A" -> pasa a NODE_NAME
    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: 'A' } }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "Ingrese Nombre" }, expect.anything());

    // 3. Enviar Nombre ("Lucas Avila") -> Pasa por NODE_NAME, y luego el auto-avanzador detecta que NODE_TEL (Telefono_WhatsApp) YA está autocompletado, saltándolo hasta FIN!
    await upsertHandler({
      type: 'notify',
      messages: [{ key: { fromMe: false, remoteJid: userJid }, message: { conversation: 'Lucas Avila' } }]
    });

    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "¡Gracias!" }, expect.anything());
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
    }), expect.anything());
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

    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "Conversación finalizada. ¡Escríbenos de nuevo para volver a empezar!" }, expect.anything());
  });

  it("Debería normalizar JID de tipo @lid a @s.whatsapp.net usando senderPn o remoteJidAlt", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    await adapter.start();

    const upsertHandler = eventListeners['messages.upsert'];
    const lidJid = "184211298336835@lid";
    const expectedPhoneJid = "5491135204879@s.whatsapp.net";

    await upsertHandler({
      type: 'notify',
      messages: [{
        key: {
          fromMe: false,
          remoteJid: lidJid,
          senderPn: "5491135204879"
        },
        message: { conversation: 'Hola' }
      }]
    });

    expect(mockSock.sendMessage).toHaveBeenCalledWith(expectedPhoneJid, { text: "Menú Principal" }, expect.anything());
  });

  it("Debería resolver JID usando remoteJidAlt, participantAlt, participant, caché o signalRepository", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    
    // Configurar signalRepository mock
    const getPNForLIDMock = jest.fn().mockResolvedValue("5491199999999@s.whatsapp.net");
    (mockSock as any).signalRepository = {
      lidMapping: {
        getPNForLID: getPNForLIDMock
      }
    };

    await adapter.start();
    const upsertHandler = eventListeners['messages.upsert'];

    // 1. Probar remoteJidAlt
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "100@lid", remoteJidAlt: "5491111111111@s.whatsapp.net" },
        message: { extendedTextMessage: { text: "Hola" } }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith("5491111111111@s.whatsapp.net", { text: "Menú Principal" }, expect.anything());

    // 2. Probar participantAlt
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "200@lid", participantAlt: "5491122222222@s.whatsapp.net" },
        message: { buttonsResponseMessage: { selectedButtonId: "Hola" } }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith("5491122222222@s.whatsapp.net", { text: "Menú Principal" }, expect.anything());

    // 3. Probar participant
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "300@lid", participant: "5491133333333@s.whatsapp.net" },
        message: { ephemeralMessage: { message: { conversation: "Hola" } } }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith("5491133333333@s.whatsapp.net", { text: "Menú Principal" }, expect.anything());

    // 4. Probar caché lidMap previo para "100@lid" sin alt metadata
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "100@lid" },
        message: { conversation: "A" }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith("5491111111111@s.whatsapp.net", { text: "Ingrese Nombre" }, expect.anything());

    // 5. Probar signalRepository
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "400@lid" },
        message: { conversation: "Hola" }
      }]
    });
    expect(getPNForLIDMock).toHaveBeenCalledWith("400@lid");
    expect(mockSock.sendMessage).toHaveBeenCalledWith("5491199999999@s.whatsapp.net", { text: "Menú Principal" }, expect.anything());

    // 6. Fallback a rawJid cuando no hay forma de resolver
    getPNForLIDMock.mockResolvedValueOnce(undefined);
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "500@lid" },
        message: { conversation: "Hola" }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith("500@lid", { text: "Menú Principal" }, expect.anything());
  });
});
