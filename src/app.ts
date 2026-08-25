import { loadConfig } from './config/config';
import { ConsoleAdapter } from './infrastructure/adapters/ConsoleAdapter';
import { WhatsAppAdapter } from './infrastructure/adapters/WhatsAppAdapter';
import { LeadRepositoryFactory } from './infrastructure/repositories/LeadRepositoryFactory';
import { AuthStorageFactory } from './infrastructure/adapters/auth/AuthStorageFactory';
import { LoggerFactory } from './infrastructure/adapters/logging/LoggerFactory';
import { ErrorHandler } from './infrastructure/logging/ErrorHandler';
import { AdminServer } from './infrastructure/web/AdminServer';
import { DecisionTreeManager } from './application/DecisionTreeManager';
import { RedisFlowRepository } from './infrastructure/repositories/RedisFlowRepository';
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

    // Inicializar el repositorio de flujos en Redis
    const redisFlowRepo = new RedisFlowRepository({
        host: config.authStorage?.redis?.host,
        port: config.authStorage?.redis?.port,
        password: config.authStorage?.redis?.password
    });

    const flowManager = new DecisionTreeManager(path.resolve(process.cwd(), 'flows'), redisFlowRepo);
    await flowManager.loadFlows();

    const defaultFlowId = config.sessionConfig?.defaultFlowId || 'flow_cfp412';
    try {
        flowManager.setDefaultFlowId(defaultFlowId);
    } catch (_err) {
        // En caso de que no estuviese registrado aún
    }

    let flowProvider;
    try {
        flowProvider = flowManager.getFlowProvider(defaultFlowId);
        console.log(`Gestor de árboles de decisión cargó el flujo por defecto: '${defaultFlowId}'`);
    } catch (_e) {
        try {
            const flowFileName = `${defaultFlowId}.json`;
            const flowPath = path.resolve(process.cwd(), 'flows', flowFileName);
            flowManager.registerFlowFromFile(defaultFlowId, flowPath);
            flowManager.setDefaultFlowId(defaultFlowId);
            flowProvider = flowManager.getFlowProvider(defaultFlowId);
            console.log(`Flujo cargado desde ${flowPath}`);
        } catch (err: any) {
            console.error(`Error crítico al cargar el flujo por defecto '${defaultFlowId}': ${err.message}. Abortando.`);
            process.exit(1);
        }
    }

    // Instancia el LeadRepository usando el patrón Factory (por defecto 'csv', o 'google_sheets' / 'googlesheet')
    const leadRepo = LeadRepositoryFactory.create(config.leadsStorage.type, config);

    // Instancia el AuthStorageAdapter usando el patrón Factory (por defecto 'file', o 'google' / 'gcs')
    const authStorage = AuthStorageFactory.create(config.authStorage?.type, config);

    if (config.interface === 'command') {
        const adapter = new ConsoleAdapter(flowProvider, leadRepo);
        adapter.start();
    } else if (config.interface === 'baileys') {
        const adapter = new WhatsAppAdapter(flowProvider, leadRepo, authStorage, flowManager, config.sessionConfig);

        if (config.adminWeb?.enabled !== false) {
            const adminServer = new AdminServer(config, adapter, flowManager);
            await adminServer.start();
        }

        await adapter.start();
        // Mantener el proceso activo para evitar que el contenedor de Docker finalice
        await new Promise(() => { });
    } else {
        console.error(`Interface '${config.interface}' no configurada correctamente.`);
        process.exit(1);
    }
}

main();
