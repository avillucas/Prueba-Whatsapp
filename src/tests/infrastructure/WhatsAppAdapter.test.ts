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

    expect(mockSock.sendMessage).toHaveBeenCalledWith(lidJid, { text: "Menú Principal" }, expect.anything());
    expect((adapter as any).activeSessions.has(expectedPhoneJid)).toBe(true);
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
    expect(mockSock.sendMessage).toHaveBeenCalledWith("100@lid", { text: "Menú Principal" }, expect.anything());
    expect((adapter as any).activeSessions.has("5491111111111@s.whatsapp.net")).toBe(true);

    // 2. Probar participantAlt
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "200@lid", participantAlt: "5491122222222@s.whatsapp.net" },
        message: { buttonsResponseMessage: { selectedButtonId: "Hola" } }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith("200@lid", { text: "Menú Principal" }, expect.anything());
    expect((adapter as any).activeSessions.has("5491122222222@s.whatsapp.net")).toBe(true);

    // 3. Probar participant
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "300@lid", participant: "5491133333333@s.whatsapp.net" },
        message: { ephemeralMessage: { message: { conversation: "Hola" } } }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith("300@lid", { text: "Menú Principal" }, expect.anything());
    expect((adapter as any).activeSessions.has("5491133333333@s.whatsapp.net")).toBe(true);

    // 4. Probar caché lidMap previo para "100@lid" sin alt metadata
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "100@lid" },
        message: { conversation: "A" }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith("100@lid", { text: "Ingrese Nombre" }, expect.anything());

    // 5. Probar signalRepository
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: "400@lid" },
        message: { conversation: "Hola" }
      }]
    });
    expect(getPNForLIDMock).toHaveBeenCalledWith("400@lid");
    expect(mockSock.sendMessage).toHaveBeenCalledWith("400@lid", { text: "Menú Principal" }, expect.anything());
    expect((adapter as any).activeSessions.has("5491199999999@s.whatsapp.net")).toBe(true);

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

  it("Debería retornar estado, QR y usuario conectado correctamente", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    expect(adapter.getStatus()).toBe('DISCONNECTED');
    expect(adapter.getQR()).toBeNull();
    expect(adapter.getConnectedUser()).toBeNull();

    await adapter.start();

    // Simular evento QR
    eventListeners['connection.update']({ qr: 'test_qr_code' });
    expect(adapter.getStatus()).toBe('WAITING_QR');
    expect(adapter.getQR()).toBe('test_qr_code');

    // Simular evento connection open
    eventListeners['connection.update']({ connection: 'open' });
    expect(adapter.getStatus()).toBe('CONNECTED');
    expect(adapter.getQR()).toBeNull();

    // Simular evento connection close
    eventListeners['connection.update']({ connection: 'close', lastDisconnect: { error: { output: { statusCode: 500 } } } });
    expect(adapter.getStatus()).toBe('DISCONNECTED');
  });

  it("Debería reiniciar la cuenta y limpiar la autenticación al llamar a resetAccount", async () => {
    const mockAuthStorage = {
      beforeAuth: jest.fn().mockResolvedValue(undefined),
      afterSaveCreds: jest.fn().mockResolvedValue(undefined),
      getAuthDir: jest.fn().mockReturnValue('./test_auth'),
      clearAuth: jest.fn().mockResolvedValue(undefined)
    };

    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo, mockAuthStorage as any);
    await adapter.start();

    await adapter.resetAccount();

    expect(mockAuthStorage.clearAuth).toHaveBeenCalled();
    expect(adapter.getStatus()).toBe('DISCONNECTED');
  });

  it("Debería retornar el flujo id adecuado en getFlowIdForPhone bajo distintas configuraciones", () => {
    const mockFlowMgr = {
      getDefaultFlowId: jest.fn().mockReturnValue('flow_manager_default')
    };

    // 1. sessionConfig tiene defaultFlowId
    const adapter1 = new WhatsAppAdapter(mockFlowProvider, mockRepo, undefined, mockFlowMgr as any, { defaultFlowId: 'flow_custom' });
    expect(adapter1.getFlowIdForPhone('123')).toBe('flow_custom');

    // 2. sessionConfig sin defaultFlowId pero con flowManager
    const adapter2 = new WhatsAppAdapter(mockFlowProvider, mockRepo, undefined, mockFlowMgr as any, { defaultFlowId: '' });
    expect(adapter2.getFlowIdForPhone('123')).toBe('flow_manager_default');

    // 3. Ninguno definido -> fallback 'flow_cfp412'
    const adapter3 = new WhatsAppAdapter(mockFlowProvider, mockRepo, undefined, undefined, { defaultFlowId: '' });
    expect(adapter3.getFlowIdForPhone('123')).toBe('flow_cfp412');
  });

  it("Debería gestionar el inicio y detención del timer de inactividad", () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    adapter.stopTimeoutChecker();
    expect((adapter as any).timeoutTimer).toBeNull();

    adapter.startTimeoutChecker();
    expect((adapter as any).timeoutTimer).not.toBeNull();

    // Iniciar de nuevo no debe crear un segundo timer
    const timerRef = (adapter as any).timeoutTimer;
    adapter.startTimeoutChecker();
    expect((adapter as any).timeoutTimer).toBe(timerRef);

    adapter.stopTimeoutChecker();
    expect((adapter as any).timeoutTimer).toBeNull();
  });

  it("Debería enviar un mensaje de inactividad si la conexión está abierta y expira la sesión", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    await adapter.start();

    // Simular estado CONNECTED
    eventListeners['connection.update']({ connection: 'open' });

    (adapter as any).activeSessions.set('123456@s.whatsapp.net', {
      sessionId: 'SESS_123',
      engine: {} as any,
      flowId: 'flow_cfp412',
      lastActivityAt: Date.now() - 3600000 // 1 hora atras
    });

    await adapter.checkSessionTimeouts();

    expect(mockSock.sendMessage).toHaveBeenCalledWith(
      '123456@s.whatsapp.net',
      expect.objectContaining({ text: expect.stringContaining('cerrado automáticamente') })
    );
  });

  it("Debería enviar el saludo inicial si lo primero que envía el usuario es un archivo/audio/imagen sin texto", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    await adapter.start();

    const upsertHandler = eventListeners['messages.upsert'];
    const userAudioJid = "5491188888888@s.whatsapp.net";
    const userImageJid = "5491177777777@s.whatsapp.net";

    // 1. Primer mensaje es un audio (audioMessage sin texto)
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: userAudioJid },
        message: { audioMessage: { url: 'https://example.com/audio.ogg', mimetype: 'audio/ogg' } }
      }]
    });

    expect(mockSock.sendMessage).toHaveBeenCalledWith(userAudioJid, { text: "Menú Principal" }, expect.anything());
    expect((adapter as any).activeSessions.has(userAudioJid)).toBe(true);

    // 2. Primer mensaje es una imagen sin leyenda (imageMessage sin caption)
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: userImageJid },
        message: { imageMessage: { url: 'https://example.com/photo.jpg', mimetype: 'image/jpeg' } }
      }]
    });

    expect(mockSock.sendMessage).toHaveBeenCalledWith(userImageJid, { text: "Menú Principal" }, expect.anything());
    expect((adapter as any).activeSessions.has(userImageJid)).toBe(true);
  });

  it("Debería procesar la leyenda (caption) de imágenes/videos o ignorar mensajes de reacción", async () => {
    const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
    await adapter.start();

    const upsertHandler = eventListeners['messages.upsert'];
    const userJid = "5491166666666@s.whatsapp.net";

    // 1. Mensaje de reacción -> Ignorado
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: userJid },
        message: { reactionMessage: { text: "👍", key: { id: "123" } } }
      }]
    });
    expect(mockSock.sendMessage).not.toHaveBeenCalled();

    // 2. Imagen con caption "A" -> inicia sesión y si se envía otra opción procesa "A"
    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: userJid },
        message: { imageMessage: { caption: "Hola" } }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "Menú Principal" }, expect.anything());

    await upsertHandler({
      type: 'notify',
      messages: [{
        key: { fromMe: false, remoteJid: userJid },
        message: { imageMessage: { caption: "A" } }
      }]
    });
    expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "Ingrese Nombre" }, expect.anything());
  });

  describe("Modo Asesor (Handover Humano y Pausa de Automatización)", () => {
    it("Debería activar Modo Asesor cuando un ASESOR responde desde WhatsApp Business y pausar respuestas automáticas", async () => {
      const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
      await adapter.start();
      const upsertHandler = eventListeners['messages.upsert'];
      const userJid = "5491155555555@s.whatsapp.net";

      // 1. CLIENTE envía "Hola" -> Bot envía menú inicial
      await upsertHandler({
        type: 'notify',
        messages: [{
          key: { fromMe: false, remoteJid: userJid },
          message: { conversation: "Hola" }
        }]
      });
      expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "Menú Principal" }, expect.anything());
      mockSock.sendMessage.mockClear();

      // 2. ASESOR envía mensaje saliente desde la app (fromMe: true, ID no generado por bot)
      await upsertHandler({
        type: 'notify',
        messages: [{
          key: { fromMe: true, remoteJid: userJid, id: "ASESOR_MSG_123" },
          message: { conversation: "Hola, soy el asesor Juan, ¿en qué te puedo ayudar?" }
        }]
      });

      const session = (adapter as any).activeSessions.get(userJid);
      expect(session).toBeDefined();
      expect(session.isHumanMode).toBe(true);

      // 3. CLIENTE responde al ASESOR -> El bot NO debe enviar respuesta automática
      await upsertHandler({
        type: 'notify',
        messages: [{
          key: { fromMe: false, remoteJid: userJid },
          message: { conversation: "Buenas tardes, quería consultar los requisitos de inscripción." }
        }]
      });
      expect(mockSock.sendMessage).not.toHaveBeenCalled();
    });

    it("Debería permitir al ASESOR reactivar la automatización con el comando #bot", async () => {
      const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
      await adapter.start();
      const upsertHandler = eventListeners['messages.upsert'];
      const userJid = "5491144444444@s.whatsapp.net";

      // Iniciar sesión en modo asesor
      adapter.setHumanMode(userJid, true);
      (adapter as any).activeSessions.set(userJid, {
        sessionId: "SESS_TEST",
        engine: {} as any,
        flowId: "flow_cfp412",
        lastActivityAt: Date.now(),
        isHumanMode: true
      });

      // ASESOR envía #bot
      await upsertHandler({
        type: 'notify',
        messages: [{
          key: { fromMe: true, remoteJid: userJid, id: "ASESOR_CMD_1" },
          message: { conversation: "#bot" }
        }]
      });

      const session = (adapter as any).activeSessions.get(userJid);
      expect(session.isHumanMode).toBe(false);
      expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, { text: "🤖 Automatización reactivada por el Asesor." }, expect.anything());
    });

    it("Debería permitir al CLIENTE solicitar el menú y reactivar el bot cuando está en Modo Asesor", async () => {
      const adapter = new WhatsAppAdapter(mockFlowProvider, mockRepo);
      await adapter.start();
      const upsertHandler = eventListeners['messages.upsert'];
      const userJid = "5491133333333@s.whatsapp.net";

      // 1. Mensaje inicial de CLIENTE
      await upsertHandler({
        type: 'notify',
        messages: [{
          key: { fromMe: false, remoteJid: userJid },
          message: { conversation: "Hola" }
        }]
      });

      // 2. Intervención de ASESOR
      await upsertHandler({
        type: 'notify',
        messages: [{
          key: { fromMe: true, remoteJid: userJid, id: "HUMAN_1" },
          message: { conversation: "Atendido por asesor." }
        }]
      });
      expect((adapter as any).activeSessions.get(userJid).isHumanMode).toBe(true);
      mockSock.sendMessage.mockClear();

      // 3. CLIENTE envía "menu"
      await upsertHandler({
        type: 'notify',
        messages: [{
          key: { fromMe: false, remoteJid: userJid },
          message: { conversation: "menu" }
        }]
      });

      // La sesión se despausa y se reinicia
      expect(mockSock.sendMessage).toHaveBeenCalledWith(userJid, expect.objectContaining({
        text: expect.stringContaining("Conversación finalizada")
      }), expect.anything());
    });
  });
});

