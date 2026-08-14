import * as readline from 'readline';
import { DecisionEngine, FlowProvider } from "motor-decision";
import { SessionLeadManager } from "../../application/SessionLeadManager";
import { LeadRepository } from "../../domain/LeadRepository";

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
        console.log("\n[Sistema: Guardando datos recolectados (Lead) antes de salir...]");
        await this.leadManager.finalizeSession(this.sessionId);
        console.log("\n¡Hasta luego! 👋\n");
        this.rl.close();
        return;
      }

      const { nextNode, extractedData, error } = this.engine.processAnswer(answer.trim());
      
      if (nextNode) {
        if (extractedData) {
          console.log(`\n✅ [Sistema: Dato extraído: { clave: '${extractedData.key}', valor: '${extractedData.value}' }]`);
          // Guardamos el dato temporalmente en el manejador
          this.leadManager.addData(this.sessionId, extractedData.key, extractedData.value);
        }
        
        if (nextNode.extractData) {
          console.log(`\n[Sistema: Dato extraído esperado en el próximo paso -> '${nextNode.extractData}']`);
        }
        this.printBot(nextNode.text);

        // Si el próximo nodo es un cierre natural, guardamos el lead.
        if (nextNode.id.includes("FIN") || nextNode.id.includes("CIERRE")) {
           console.log("\n[Sistema: Fin de flujo detectado. Guardando el Lead...]");
           await this.leadManager.finalizeSession(this.sessionId);
        }
      } else {
        console.log(`\n❌ [Sistema: Error - ${error}]`);
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
      console.log(`[Sistema: Dato extraído esperado en el próximo paso -> '${currentNode.extractData}']`);
    }
    this.printBot(currentNode.text);

    this.promptUser();
  }
}
