import { WhatsAppAdapter } from '../../infrastructure/adapters/WhatsAppAdapter';
import { SimpleFlowProvider } from '../../application/DecisionTreeManager';
import { DecisionNode } from 'motor-decision';

jest.mock('@whiskeysockets/baileys', () => ({
  makeWASocket: jest.fn(() => ({ ev: { on: jest.fn() } })),
  useMultiFileAuthState: jest.fn().mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
  DisconnectReason: { loggedOut: 401 }
}));

describe('Session Timeout and Default Flow Routing Test Suite', () => {
  let mockLeadRepo: any;
  let mockFlowProvider: SimpleFlowProvider;
  let adapter: WhatsAppAdapter;

  const testNodes: DecisionNode[] = [
    { id: 'MSG_INICIAL', text: 'Inicio de prueba', options: [] }
  ];

  beforeEach(() => {
    mockLeadRepo = {
      saveSessionData: jest.fn().mockResolvedValue(undefined)
    };

    mockFlowProvider = new SimpleFlowProvider(testNodes, 'MSG_INICIAL');

    adapter = new WhatsAppAdapter(
      mockFlowProvider,
      mockLeadRepo,
      undefined,
      undefined,
      {
        timeoutMinutes: 15,
        defaultFlowId: 'flow_cfp412'
      }
    );
    adapter.stopTimeoutChecker();
  });

  afterEach(() => {
    adapter.stopTimeoutChecker();
  });

  describe('Obtención de Flujo por Defecto (getFlowIdForPhone)', () => {
    it('debería retornar el flujo por defecto configurado', () => {
      const flowId = adapter.getFlowIdForPhone('5491122334455@s.whatsapp.net');
      expect(flowId).toBe('flow_cfp412');
    });
  });

  describe('Manejo de Inactividad y Timeout de Sesión (checkSessionTimeouts)', () => {
    it('debería permitir actualizar la configuración de sesiones dinámicamente', () => {
      adapter.updateSessionConfig({
        timeoutMinutes: 5,
        defaultFlowId: 'flow_custom'
      });

      const config = adapter.getSessionConfig();
      expect(config.timeoutMinutes).toBe(5);
      expect(adapter.getFlowIdForPhone('5491122334455@s.whatsapp.net')).toBe('flow_custom');
    });

    it('debería cerrar la sesión si transcurrió más tiempo del límite de inactividad', async () => {
      adapter.updateSessionConfig({ timeoutMinutes: 1 }); // 1 minuto timeout

      const activeSessionsMap = (adapter as any).activeSessions;
      activeSessionsMap.set('5491100000000@s.whatsapp.net', {
        sessionId: 'TEST_SESSION_123',
        engine: {} as any,
        flowId: 'flow_cfp412',
        lastActivityAt: Date.now() - 120000 // 2 minutos atras (expirada)
      });

      expect(activeSessionsMap.size).toBe(1);

      await adapter.checkSessionTimeouts();

      expect(activeSessionsMap.size).toBe(0);
    });

    it('debería mantener la sesión si no ha alcanzado el tiempo límite de inactividad', async () => {
      adapter.updateSessionConfig({ timeoutMinutes: 10 });

      const activeSessionsMap = (adapter as any).activeSessions;
      activeSessionsMap.set('5491100000000@s.whatsapp.net', {
        sessionId: 'TEST_SESSION_456',
        engine: {} as any,
        flowId: 'flow_cfp412',
        lastActivityAt: Date.now() - 60000 // 1 minuto atras (activa)
      });

      expect(activeSessionsMap.size).toBe(1);

      await adapter.checkSessionTimeouts();

      expect(activeSessionsMap.size).toBe(1);
    });
  });
});
