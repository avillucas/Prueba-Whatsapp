import { DecisionNode } from 'motor-decision';

export interface FlowRepository {
  /**
   * Obtiene un flujo de decisión por su ID.
   * Devuelve null si no existe.
   */
  getFlow(flowId: string): Promise<DecisionNode[] | null>;

  /**
   * Guarda o actualiza un flujo de decisión por su ID.
   */
  saveFlow(flowId: string, nodes: DecisionNode[]): Promise<void>;

  /**
   * Lista los IDs de todos los flujos de decisión almacenados.
   */
  listFlows(): Promise<string[]>;

  /**
   * Elimina un flujo de decisión si existe.
   */
  deleteFlow?(flowId: string): Promise<void>;
}
