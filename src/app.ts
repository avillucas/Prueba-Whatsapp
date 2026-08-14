import { loadConfig } from './config';
import { JsonFlowAdapter } from 'motor-decision';
import { ConsoleAdapter } from './interfaces/ConsoleAdapter';
import { WhatsAppAdapter } from './interfaces/WhatsAppAdapter';
import { CsvLeadRepository } from './storage/CsvLeadRepository';

async function main() {
    const config = loadConfig();
    console.log(`Cargando configuración... Interface: ${config.interface}, Entrada: ${config.inputAdapter}`);

    let flowProvider;
    if (config.inputAdapter === 'file') {
        try {
            flowProvider = new JsonFlowAdapter(config.mockupFilePath, "MSG_INICIAL");
            console.log(`Mockup cargado desde ${config.mockupFilePath}`);
        } catch (e) {
            console.error("Error crítico al cargar los datos del mockup. Abortando.");
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
