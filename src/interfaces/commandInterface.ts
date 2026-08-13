import * as readline from 'readline';
import { DecisionEngine, DecisionNode } from 'motor-decision';
import { AppConfig } from '../config';
import { saveLead } from '../storage/csvAdapter';

export function startCommandInterface(config: AppConfig, nodes: DecisionNode[]) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("Iniciando interfaz de comandos para el motor de decisiones...");

    const engine = new DecisionEngine(nodes, "MSG_INICIAL");
    let currentNode = engine.getCurrentNode();

    console.log("=========================================");
    console.log(currentNode.text);
    console.log("=========================================");

    const askQuestion = () => {
        rl.question('> ', (answer) => {
            const trimmedAnswer = answer.trim();
            if (trimmedAnswer.toLowerCase() === 'salir') {
                console.log("Saliendo de la interfaz de comandos...");
                rl.close();
                return;
            }

            const { nextNode, extractedData, error } = engine.processAnswer(trimmedAnswer);

            if (nextNode) {
                if (extractedData) {
                    console.log(`[DATO EXTRAÍDO] ${extractedData.key}: ${extractedData.value}`);
                    saveLead(config, "console_user", extractedData.key, extractedData.value);
                }
                currentNode = nextNode;
                console.log("\n=========================================");
                console.log(currentNode.text);
                console.log("=========================================");
            } else {
                console.log(`\n⚠️ Opción no válida.\n\n${engine.getCurrentNode().text}`);
            }

            askQuestion();
        });
    };

    askQuestion();
}
