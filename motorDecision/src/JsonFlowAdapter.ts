import * as fs from 'fs';
import { FlowProvider } from './FlowProvider';
import { DecisionNode } from './DecisionEngine';

export class JsonFlowAdapter implements FlowProvider {
  private flow: DecisionNode[];
  private initialNodeId: string;

  constructor(filePath: string, initialNodeId: string = "MSG_INICIAL") {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo de flujo JSON no existe: ${filePath}`);
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    this.flow = JSON.parse(fileContent) as DecisionNode[];
    this.initialNodeId = initialNodeId;
  }

  getFlow(): DecisionNode[] {
    return this.flow;
  }

  getInitialNodeId(): string {
    return this.initialNodeId;
  }
}
