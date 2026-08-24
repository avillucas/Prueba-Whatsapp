import * as fs from 'fs';
import * as path from 'path';
import { DecisionNode, DecisionEngine, FlowProvider, JsonFlowAdapter } from 'motor-decision';
import { FlowRepository } from '../domain/FlowRepository';

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

  constructor(
    private flowsDir?: string,
    private flowRepository?: FlowRepository
  ) {
    if (!this.flowsDir) {
      this.flowsDir = path.resolve(process.cwd(), 'flows');
    }
    this.loadFlowsFromDirectory();
  }

  /**
   * Asigna o reemplaza el repositorio de flujos (ej. RedisFlowRepository).
   */
  public setFlowRepository(repository: FlowRepository): void {
    this.flowRepository = repository;
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
   * Carga y sincroniza los flujos con Redis si el repositorio está activo.
   * - Si un flujo local no existe en Redis, se guarda en Redis (sembrado / seed).
   * - Si un flujo ya existe en Redis, prevalece la versión de Redis (ediciones previas del usuario).
   */
  public async loadFlows(dir?: string): Promise<void> {
    this.loadFlowsFromDirectory(dir);

    if (!this.flowRepository) {
      return;
    }

    try {
      const redisFlowIds = await this.flowRepository.listFlows();
      const localFlowIds = Array.from(this.flowRegistry.keys());

      // Seed: Para cada flujo local de disco que NO esté en Redis, se inicializa en Redis
      for (const flowId of localFlowIds) {
        if (!redisFlowIds.includes(flowId)) {
          const nodes = this.flowRegistry.get(flowId);
          if (nodes) {
            await this.flowRepository.saveFlow(flowId, nodes);
          }
        }
      }

      // Cargar/sobrescribir en la memoria local todas las versiones guardadas en Redis
      for (const flowId of redisFlowIds) {
        const redisNodes = await this.flowRepository.getFlow(flowId);
        if (redisNodes && Array.isArray(redisNodes) && redisNodes.length > 0) {
          this.registerFlowNodes(flowId, redisNodes);
        }
      }
    } catch (err: any) {
      console.error(`⚠️ Aviso al sincronizar flujos con Redis: ${err.message}. Se conservan flujos locales.`);
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
   * Registra directamente un conjunto de nodos para un árbol de decisión en memoria.
   */
  public registerFlowNodes(flowId: string, nodes: DecisionNode[], initialNodeId: string = 'MSG_INICIAL'): void {
    this.flowRegistry.set(flowId, nodes);
    this.initialNodeRegistry.set(flowId, initialNodeId);
  }

  /**
   * Guarda o actualiza un flujo de decisión (Hot-Reload en memoria, actualización en Redis y archivo local).
   */
  public async saveFlow(flowId: string, nodes: DecisionNode[], initialNodeId: string = 'MSG_INICIAL'): Promise<void> {
    this.registerFlowNodes(flowId, nodes, initialNodeId);

    if (this.flowRepository) {
      await this.flowRepository.saveFlow(flowId, nodes);
    }

    if (this.flowsDir) {
      try {
        if (!fs.existsSync(this.flowsDir)) {
          fs.mkdirSync(this.flowsDir, { recursive: true });
        }
        const filePath = path.join(this.flowsDir, `${flowId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(nodes, null, 2), 'utf-8');
      } catch (err: any) {
        console.error(`⚠️ No se pudo guardar respaldo local en disco para '${flowId}': ${err.message}`);
      }
    }
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
