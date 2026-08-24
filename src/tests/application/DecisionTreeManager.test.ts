import * as path from 'path';
import * as fs from 'fs';
import { DecisionTreeManager, SimpleFlowProvider } from '../../application/DecisionTreeManager';
import { SessionLeadManager } from '../../application/SessionLeadManager';
import { LeadRepository } from '../../domain/LeadRepository';
import { LeadContacto, LeadListaEspera } from '../../domain/Lead';
import { DecisionNode } from 'motor-decision';

class MockLeadRepository implements LeadRepository {
  public savedContactos: { sessionId: string; lead: LeadContacto }[] = [];
  public savedListasEspera: { sessionId: string; lead: LeadListaEspera }[] = [];

  async saveContacto(sessionId: string, lead: LeadContacto): Promise<void> {
    this.savedContactos.push({ sessionId, lead });
  }

  async saveListaEspera(sessionId: string, lead: LeadListaEspera): Promise<void> {
    this.savedListasEspera.push({ sessionId, lead });
  }

  async getLeads(): Promise<(LeadContacto | LeadListaEspera)[]> {
    return [
      ...this.savedContactos.map(c => c.lead),
      ...this.savedListasEspera.map(l => l.lead)
    ];
  }
}

describe('DecisionTreeManager & Session Integration', () => {
  let treeManager: DecisionTreeManager;
  let mockRepo: MockLeadRepository;
  let leadManager: SessionLeadManager;

  beforeEach(() => {
    const flowsPath = path.resolve(process.cwd(), 'flows');
    treeManager = new DecisionTreeManager(flowsPath);
    mockRepo = new MockLeadRepository();
    leadManager = new SessionLeadManager(mockRepo);
  });

  it('should load flow_cfp412 from the flows directory', () => {
    const availableFlows = treeManager.getAvailableFlows();
    expect(availableFlows).toContain('flow_cfp412');

    const provider = treeManager.getFlowProvider('flow_cfp412');
    expect(provider.getInitialNodeId()).toBe('MSG_INICIAL');
    expect(provider.getFlow().length).toBeGreaterThan(0);
  });

  it('should register custom flow nodes dynamically', () => {
    const customNodes: DecisionNode[] = [
      {
        id: 'INIT',
        text: 'Hola {{Nombre_y_Apellido}}, dinos tu correo:',
        extractData: 'Correo_Electronico',
        options: [{ match: '*', nextId: 'END' }]
      },
      {
        id: 'END',
        text: 'Gracias!',
        options: []
      }
    ];

    treeManager.registerFlowNodes('custom_flow', customNodes, 'INIT');
    expect(treeManager.getAvailableFlows()).toContain('custom_flow');

    const engine = treeManager.createEngine('custom_flow');
    expect(engine.getCurrentNode().id).toBe('INIT');
  });

  it('should replace placeholders in node text using renderNodeText', () => {
    const node: DecisionNode = {
      id: 'GREET',
      text: 'Hola {{Nombre_y_Apellido}}, tu teléfono es {{Telefono_WhatsApp}}.',
      options: []
    };

    const rendered = treeManager.renderNodeText(node, {
      Nombre_y_Apellido: 'Juan Perez',
      Telefono_WhatsApp: '+541112345678'
    });

    expect(rendered).toBe('Hola Juan Perez, tu teléfono es +541112345678.');
  });

  it('should handle pre-populated interface variables and allow auto-skipping', async () => {
    const sessionId = 'session_123';
    
    // Simular que la interfaz (ej. WhatsApp) disponibiliza el teléfono del usuario
    leadManager.initSession(sessionId, {
      Telefono_WhatsApp: '1123456789'
    });

    expect(leadManager.hasValidField(sessionId, 'Telefono_WhatsApp')).toBe(true);
    expect(leadManager.shouldSkipNode(sessionId, 'Telefono_WhatsApp')).toBe(true);

    // Opcion_Elegida no debe saltearse nunca automáticamente
    expect(leadManager.shouldSkipNode(sessionId, 'Opcion_Elegida')).toBe(false);
  });

  it('should collect lead data across questions and finalize session saving to repository', async () => {
    const sessionId = 'session_456';
    leadManager.initSession(sessionId);

    // Capturar datos en distintas preguntas
    leadManager.addData(sessionId, 'Nombre_y_Apellido', 'Maria Lopez');
    leadManager.addData(sessionId, 'Correo_Electronico', 'maria@example.com');
    leadManager.addData(sessionId, 'Curso_Interes', 'Informática');

    await leadManager.finalizeSession(sessionId);

    expect(mockRepo.savedListasEspera.length).toBe(1);
    const saved = mockRepo.savedListasEspera[0].lead;
    expect(saved.nombre).toBe('Maria Lopez');
    expect(saved.correoElectronico?.valor).toBe('maria@example.com');
    expect(saved.cursoDeInteres).toBe('Informática');
  });

  it('should correctly save LeadContacto when customized inquiry is provided', async () => {
    const sessionId = 'session_789';
    leadManager.initSession(sessionId);

    leadManager.addData(sessionId, 'Nombre_y_Apellido', 'Carlos Ruiz');
    leadManager.addData(sessionId, 'Telefono_WhatsApp', '1198765432');
    leadManager.addData(sessionId, 'Consulta_Personalizada', '¿Cuáles son los horarios del turno noche?');

    await leadManager.finalizeSession(sessionId);

    expect(mockRepo.savedContactos.length).toBe(1);
    const saved = mockRepo.savedContactos[0].lead;
    expect(saved.nombre).toBe('Carlos Ruiz');
    expect(saved.mensaje).toBe('¿Cuáles son los horarios del turno noche?');
  });

  it('debería gestionar defaultFlowId correctamente y lanzar error si no existe', () => {
    expect(treeManager.getDefaultFlowId()).toBe('flow_cfp412');
    treeManager.setDefaultFlowId('flow_cfp412');
    expect(() => treeManager.setDefaultFlowId('inexistent_flow')).toThrow(
      "El árbol de decisión 'inexistent_flow' no está registrado."
    );
  });

  it('debería lanzar error en getFlowProvider si el flujo no existe', () => {
    expect(() => treeManager.getFlowProvider('invalid_flow_id')).toThrow(
      'Árbol de decisión no encontrado: invalid_flow_id'
    );
  });

  it('debería retornar el texto original si sessionContext o node.text son indefinidos en renderNodeText', () => {
    const nodeWithoutText: DecisionNode = { id: 'TEST', text: '', options: [] };
    expect(treeManager.renderNodeText(nodeWithoutText)).toBe('');

    const nodeWithText: DecisionNode = { id: 'TEST', text: 'Hola {{Nombre_y_Apellido}}', options: [] };
    expect(treeManager.renderNodeText(nodeWithText)).toBe('Hola {{Nombre_y_Apellido}}');
  });

  it('debería ignorar la carga de flujos si el directorio no existe', () => {
    const nonExistentDir = path.resolve(process.cwd(), 'non_existent_dir_12345');
    const manager = new DecisionTreeManager(nonExistentDir);
    expect(manager.getAvailableFlows().length).toBe(0);
  });

  it('debería instanciar SimpleFlowProvider con valores por defecto y renderizar con valores vacíos', () => {
    const provider = new SimpleFlowProvider([]);
    expect(provider.getInitialNodeId()).toBe('MSG_INICIAL');

    const node: DecisionNode = { id: 'TEST', text: 'Hola {{emptyKey}}', options: [] };
    const rendered = treeManager.renderNodeText(node, { emptyKey: '' });
    expect(rendered).toBe('Hola {{emptyKey}}');
  });

  it('debería usar la carpeta flows por defecto si no se pasa flowsDir', () => {
    const manager = new DecisionTreeManager();
    expect(manager.getAvailableFlows()).toContain('flow_cfp412');
  });

  it('debería capturar error si un archivo JSON de flujo tiene formato inválido', () => {
    const tmpDir = path.resolve(process.cwd(), 'tmp_test_flows');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'corrupt.json'), '{ invalid json }');

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const manager = new DecisionTreeManager(tmpDir);

    expect(consoleSpy).toHaveBeenCalled();
    expect(manager.getAvailableFlows().length).toBe(0);
    consoleSpy.mockRestore();
    fs.unlinkSync(path.join(tmpDir, 'corrupt.json'));
    fs.rmdirSync(tmpDir);
  });
});
