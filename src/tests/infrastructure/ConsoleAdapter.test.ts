import { ConsoleAdapter } from '../../infrastructure/adapters/ConsoleAdapter';
import { FlowProvider } from 'motor-decision';

let questionCb: any = null;
const mockClose = jest.fn();

jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: (query: string, cb: any) => {
      questionCb = cb;
    },
    close: mockClose
  }))
}));

describe("ConsoleAdapter", () => {
  beforeEach(() => {
    questionCb = null;
    mockClose.mockClear();
  });

  const mockFlowProvider: FlowProvider = {
    getFlow: () => [
      {
        id: "MSG_INICIAL",
        text: "Inicio",
        extractData: "Opcion_Elegida",
        options: [
          { match: "A", nextId: "NODE_TEL" }
        ]
      },
      {
        id: "NODE_TEL",
        text: "Ingrese telefono",
        extractData: "Telefono_WhatsApp",
        options: [{ match: "*", nextId: "FIN" }]
      },
      {
        id: "FIN",
        text: "Fin del flujo",
        options: []
      }
    ],
    getInitialNodeId: () => "MSG_INICIAL"
  };

  const mockRepo = {
    saveContacto: jest.fn().mockResolvedValue(undefined),
    saveListaEspera: jest.fn().mockResolvedValue(undefined)
  };

  it("Debería iniciar y procesar flujo interactivo hasta salir", async () => {
    const adapter = new ConsoleAdapter(mockFlowProvider, mockRepo);
    adapter.start();

    // 1. Responder 'A'
    if (questionCb) await questionCb("A");

    // 2. Responder invalido '123'
    if (questionCb) await questionCb("123");

    // 3. Responder telefono valido
    if (questionCb) await questionCb("+5491135204878");

    // 4. Responder 'salir'
    if (questionCb) await questionCb("salir");

    expect(mockClose).toHaveBeenCalled();
  });

  it("Debería salir con 'menu'", async () => {
    const adapter = new ConsoleAdapter(mockFlowProvider, mockRepo);
    adapter.start();

    if (questionCb) await questionCb("menu");
    expect(mockClose).toHaveBeenCalled();
  });

  it("Debería re-preguntar ante opcion invalida", async () => {
    const adapter = new ConsoleAdapter(mockFlowProvider, mockRepo);
    adapter.start();

    if (questionCb) await questionCb("Z");
  });
});
