import { DecisionNode } from "./DecisionEngine";

export interface FlowProvider {
  getFlow(): DecisionNode[];
  getInitialNodeId(): string;
}
