import * as fs from 'fs';
import * as path from 'path';
import { DecisionNode, DecisionEngine, FlowProvider, JsonFlowAdapter } from 'motor-decision';

export class SimpleFlowProvider implements FlowProvider {
  constructor(private nodes: DecisionNode[], private initialNodeId: string = 'MSG_INICIAL') {}

  getFlow(): DecisionNode[] {
    return this.nodes;
  }

  getInitialNodeId(): string {
    return this.initialNodeId;
  }
}

export class DecisionTreeManager {
  private flowRegistry = new Map<string, DecisionNode[]>();
  private initialNodeRegistry = new Map<string, string>();
  private defaultFlowId: string = 'flow_cfp412';

  constructor(private flowsDir?: string) {
    if (!this.flowsDir) {
      this.flowsDir = path.resolve(process.cwd(), 'flows');
    }
    this.loadFlowsFromDirectory();
  }

  /**
   * Carga automáticamente todos los archivos JSON de árboles de decisión en la carpeta `flows`.
   */
  public loadFlowsFromDirectory(dir?: string): void {
    const targetDir = dir || this.flowsDir;
    if (!targetDir || !fs.existsSync(targetDir)) {
      return;
    }

    const files = fs.readdirSync(targetDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const flowId = path.basename(file, '.json');
        const filePath = path.join(targetDir, file);
        try {
          this.registerFlowFromFile(flowId, filePath);
        } catch (err: any) {
          console.error(`⚠️ Error al cargar el flujo '${file}': ${err.message}`);
        }
      }
    }
  }

  /**
   * Registra un árbol de decisión manualmente a partir de un archivo JSON.
   */
  public registerFlowFromFile(flowId: string, filePath: string, initialNodeId: string = 'MSG_INICIAL'): void {
    const adapter = new JsonFlowAdapter(filePath, initialNodeId);
    this.flowRegistry.set(flowId, adapter.getFlow());
    this.initialNodeRegistry.set(flowId, adapter.getInitialNodeId());
  }

  /**
   * Registra directamente un conjunto de nodos para un árbol de decisión.
   */
  public registerFlowNodes(flowId: string, nodes: DecisionNode[], initialNodeId: string = 'MSG_INICIAL'): void {
    this.flowRegistry.set(flowId, nodes);
    this.initialNodeRegistry.set(flowId, initialNodeId);
  }

  /**
   * Establece el árbol de decisión por defecto.
   */
  public setDefaultFlowId(flowId: string): void {
    if (!this.flowRegistry.has(flowId)) {
      throw new Error(`El árbol de decisión '${flowId}' no está registrado.`);
    }
    this.defaultFlowId = flowId;
  }

  public getDefaultFlowId(): string {
    return this.defaultFlowId;
  }

  /**
   * Lista los IDs de los árboles de decisión disponibles.
   */
  public getAvailableFlows(): string[] {
    return Array.from(this.flowRegistry.keys());
  }

  /**
   * Obtiene un FlowProvider para un árbol de decisión específico.
   */
  public getFlowProvider(flowId?: string): FlowProvider {
    const targetId = flowId || this.defaultFlowId;
    const nodes = this.flowRegistry.get(targetId);
    if (!nodes) {
      throw new Error(`Árbol de decisión no encontrado: ${targetId}`);
    }
    const initialId = this.initialNodeRegistry.get(targetId) || 'MSG_INICIAL';
    return new SimpleFlowProvider(nodes, initialId);
  }

  /**
   * Crea una nueva instancia de DecisionEngine para una sesión.
   */
  public createEngine(flowId?: string): DecisionEngine {
    const provider = this.getFlowProvider(flowId);
    return new DecisionEngine(provider.getFlow(), provider.getInitialNodeId());
  }

  /**
   * Interpola variables del contexto de sesión en el texto de un nodo.
   * Ej: "Hola {{Nombre_y_Apellido}}" -> "Hola Juan Perez"
   */
  public renderNodeText(node: DecisionNode, sessionContext?: Record<string, string>): string {
    if (!sessionContext || !node.text) return node.text;

    let text = node.text;
    for (const [key, value] of Object.entries(sessionContext)) {
      if (value) {
        const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        text = text.replace(placeholder, value);
      }
    }
    return text;
  }
}
