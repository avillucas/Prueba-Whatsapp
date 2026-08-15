import { loadConfig } from './config/config';
import { JsonFlowAdapter } from 'motor-decision';
import { ConsoleAdapter } from './infrastructure/adapters/ConsoleAdapter';
import { WhatsAppAdapter } from './infrastructure/adapters/WhatsAppAdapter';
import { LeadRepositoryFactory } from './infrastructure/repositories/LeadRepositoryFactory';
import { AuthStorageFactory } from './infrastructure/adapters/auth/AuthStorageFactory';
import { LoggerFactory } from './infrastructure/adapters/logging/LoggerFactory';
import { ErrorHandler } from './infrastructure/logging/ErrorHandler';
import * as path from 'path';

async function main() {
    let config;
    try {
        config = loadConfig();
    } catch (e: any) {
        console.error(`❌ ${e.message}`);
        process.exit(1);
    }

    // Configurar el adaptador de logging según variables de entorno o config.json
    const loggerAdapter = LoggerFactory.create(config.loggingStorage?.type, config);
    ErrorHandler.setAdapter(loggerAdapter);

    console.log(`Cargando configuración... Interface: ${config.interface}, Entrada: ${config.inputAdapter}, Almacenamiento: ${config.leadsStorage.type}`);

    let flowProvider;
    if (config.inputAdapter === 'file') {
        try {
            const flowPath = path.resolve(process.cwd(), 'flows', config.flowFile);
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

    // Instancia el LeadRepository usando el patrón Factory (por defecto 'csv', o 'google_sheets' / 'googlesheet')
    const leadRepo = LeadRepositoryFactory.create(config.leadsStorage.type, config);

    // Instancia el AuthStorageAdapter usando el patrón Factory (por defecto 'file', o 'google' / 'gcs')
    const authStorage = AuthStorageFactory.create(config.authStorage?.type, config);

    if (config.interface === 'command') {
        const adapter = new ConsoleAdapter(flowProvider, leadRepo);
        adapter.start();
    } else if (config.interface === 'baileys') {
        const adapter = new WhatsAppAdapter(flowProvider, leadRepo, authStorage);
        await adapter.start();
    } else {
        console.error(`Interface '${config.interface}' no configurada correctamente.`);
        process.exit(1);
    }
}

main();
