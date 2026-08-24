import { WhatsAppAdapter } from '../../infrastructure/adapters/WhatsAppAdapter';
import { SimpleFlowProvider } from '../../application/DecisionTreeManager';
import { DecisionNode } from 'motor-decision';

describe('Session Timeout and Phone Flow Routing Test Suite', () => {
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
        phoneFlowMap: {
          '5491122334455': 'flow_vip',
          '54911': 'flow_bsas',
          'default': 'flow_cfp412'
        }
      }
    );
    adapter.stopTimeoutChecker();
  });

  afterEach(() => {
    adapter.stopTimeoutChecker();
  });

  describe('Ruteo de Flujos por Número de Teléfono (getFlowIdForPhone)', () => {
    it('debería mapear correctamente un número con coincidencia exacta', () => {
      const flowId = adapter.getFlowIdForPhone('5491122334455@s.whatsapp.net');
      expect(flowId).toBe('flow_vip');
    });

    it('debería mapear por prefijo de número si no hay coincidencia exacta', () => {
      const flowId = adapter.getFlowIdForPhone('5491199887766@s.whatsapp.net');
      expect(flowId).toBe('flow_bsas');
    });

    it('debería retornar la regla default o fallback si el número no coincide con ningún mapeo específico', () => {
      const flowId = adapter.getFlowIdForPhone('15551234567@s.whatsapp.net');
      expect(flowId).toBe('flow_cfp412');
    });
  });

  describe('Manejo de Inactividad y Timeout de Sesión (checkSessionTimeouts)', () => {
    it('debería permitir actualizar la configuración de sesiones dinámicamente', () => {
      adapter.updateSessionConfig({
        timeoutMinutes: 5,
        phoneFlowMap: { '5491122334455': 'flow_custom' }
      });

      const config = adapter.getSessionConfig();
      expect(config.timeoutMinutes).toBe(5);
      expect(adapter.getFlowIdForPhone('5491122334455@s.whatsapp.net')).toBe('flow_custom');
    });

    it('debería cerrar la sesión si transcurrió más tiempo del límite de inactividad', async () => {
      adapter.updateSessionConfig({ timeoutMinutes: 1 }); // 1 minuto timeout

      // Acceder a la colección privada de sesiones para simular una sesión antigua
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
