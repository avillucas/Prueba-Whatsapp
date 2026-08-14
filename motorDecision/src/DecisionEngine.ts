export interface DecisionOption {
  match: string;
  nextId: string;
}

export interface DecisionNode {
  id: string;
  text: string;
  options: DecisionOption[];
  extractData?: string; // Nombre del campo a extraer de la respuesta del usuario (opcional)
}

export interface TransitionResult {
  nextNode: DecisionNode | null;
  extractedData?: {
    key: string;
    value: string;
  };
  error?: string;
}

export class DecisionEngine {
  private currentNodeId: string;
  private nodesMap: Map<string, DecisionNode>;

  constructor(nodes: DecisionNode[], initialState: string) {
    this.nodesMap = new Map(nodes.map(n => [n.id, n]));
    if (!this.nodesMap.has(initialState)) {
      throw new Error(`Initial state node '${initialState}' not found.`);
    }
    this.currentNodeId = initialState;
  }

  getCurrentNode(): DecisionNode {
    const node = this.nodesMap.get(this.currentNodeId);
    if (!node) {
      throw new Error(`Current node '${this.currentNodeId}' not found in configuration.`);
    }
    return node;
  }

  processAnswer(answer: string): TransitionResult {
    const currentNode = this.getCurrentNode();
    
    for (const option of currentNode.options) {
      if (option.match === '*' || option.match.toLowerCase() === answer.toLowerCase()) {
        const nextNode = this.nodesMap.get(option.nextId);
        if (nextNode) {
          const result: TransitionResult = { nextNode };
          
          if (currentNode.extractData) {
            result.extractedData = {
              key: currentNode.extractData,
              value: answer
            };
          }

          this.currentNodeId = nextNode.id;
          return result;
        }
      }
    }
    
    // No match found
    return {
      nextNode: null,
      error: `Invalid answer for node '${currentNode.id}'`
    };
  }
}
