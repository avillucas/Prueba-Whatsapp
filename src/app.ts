import { loadConfig } from './config/config';
import { JsonFlowAdapter } from 'motor-decision';
import { ConsoleAdapter } from './infrastructure/adapters/ConsoleAdapter';
import { WhatsAppAdapter } from './infrastructure/adapters/WhatsAppAdapter';
import { CsvLeadRepository } from './infrastructure/repositories/CsvLeadRepository';
import * as path from 'path';

async function main() {
    const config = loadConfig();
    console.log(`Cargando configuración... Interface: ${config.interface}, Entrada: ${config.inputAdapter}`);

    let flowProvider;
    if (config.inputAdapter === 'file') {
        try {
            const flowPath = path.resolve(process.cwd(), 'src/flows', config.flowFile);
            flowProvider = new JsonFlowAdapter(flowPath, "MSG_INICIAL");
            console.log(`Flujo cargado desde ${flowPath}`);
        } catch (e) {
            console.error("Error crítico al cargar el flujo. Abortando.");
            process.exit(1);
        }
    } else {
        console.error(`Adaptador de entrada '${config.inputAdapter}' no soportado aún.`);
        process.exit(1);
    }

    const leadRepo = new CsvLeadRepository('./data');

    if (config.interface === 'command') {
        const adapter = new ConsoleAdapter(flowProvider, leadRepo);
        adapter.start();
    } else if (config.interface === 'baileys') {
        const adapter = new WhatsAppAdapter(flowProvider, leadRepo);
        await adapter.start();
    } else {
        console.error(`Interface '${config.interface}' no configurada correctamente.`);
        process.exit(1);
    }
}

main();
