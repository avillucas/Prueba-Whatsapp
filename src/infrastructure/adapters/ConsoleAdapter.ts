import * as readline from 'readline';
import { DecisionEngine, FlowProvider } from "motor-decision";
import { SessionLeadManager } from "../../application/SessionLeadManager";
import { LeadRepository } from "../../domain/LeadRepository";
import { ErrorHandler } from "../logging/ErrorHandler";

export class ConsoleAdapter {
  private engine: DecisionEngine;
  private leadManager: SessionLeadManager;
  private sessionId: string;
  private rl: readline.Interface;

  constructor(flowProvider: FlowProvider, leadRepo: LeadRepository) {
    this.engine = new DecisionEngine(flowProvider.getFlow(), flowProvider.getInitialNodeId());
    this.leadManager = new SessionLeadManager(leadRepo);
    
    // Generamos un ID de sesión simulado único por cada ejecución del comando
    this.sessionId = `console_${Date.now()}`;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  private printBot(text: string) {
    console.log(`\n🤖 Bot:\n${text}\n`);
  }

  private async promptUser() {
    this.rl.question('👤 Tú: ', async (answer) => {
      if (answer.toLowerCase().trim() === 'salir' || answer.toLowerCase().trim() === 'menu') {
        ErrorHandler.logSystem('ConsoleAdapter', `Guardando datos recolectados (Lead) antes de salir (${this.sessionId})`);
        await this.leadManager.finalizeSession(this.sessionId);
        console.log("\n¡Hasta luego! 👋\n");
        this.rl.close();
        return;
      }

      const currentNode = this.engine.getCurrentNode();
      if (currentNode.extractData) {
        const validationError = this.leadManager.validateField(currentNode.extractData, answer.trim());
        if (validationError) {
          ErrorHandler.logSystem('ConsoleAdapter', `Error de validación: ${validationError}`);
          this.printBot(currentNode.text);
          this.promptUser();
          return;
        }
      }

      const { nextNode, extractedData, error } = this.engine.processAnswer(answer.trim());
      
      if (nextNode) {
        if (extractedData) {
          ErrorHandler.logSystem('ConsoleAdapter', `Dato extraído: { clave: '${extractedData.key}', valor: '${extractedData.value}' }`);
          this.leadManager.addData(this.sessionId, extractedData.key, extractedData.value);
        }
        
        if (nextNode.extractData) {
          ErrorHandler.logSystem('ConsoleAdapter', `Dato extraído esperado en el próximo paso: '${nextNode.extractData}'`);
        }
        this.printBot(nextNode.text);

        if (nextNode.id.includes("FIN") || nextNode.id.includes("CIERRE")) {
           ErrorHandler.logSystem('ConsoleAdapter', `Fin de flujo detectado (${this.sessionId}). Guardando el Lead.`);
           await this.leadManager.finalizeSession(this.sessionId);
        }
      } else {
        ErrorHandler.handle('ConsoleAdapter', new Error(`Opción no válida: ${error}`));
        this.printBot(this.engine.getCurrentNode().text);
      }

      this.promptUser();
    });
  }

  public start() {
    console.log("\n=============================================");
    console.log("=== SIMULADOR DE CHATBOT (Console)       ===");
    console.log("=============================================\n");
    console.log("Escribe 'salir' en cualquier momento para terminar.\n");

    const currentNode = this.engine.getCurrentNode();
    if (currentNode.extractData) {
      ErrorHandler.logSystem('ConsoleAdapter', `Dato extraído esperado en el próximo paso: '${currentNode.extractData}'`);
    }
    this.printBot(currentNode.text);

    this.promptUser();
  }
}
