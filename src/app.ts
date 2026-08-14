import { loadConfig } from './config/config';
import { JsonFlowAdapter } from 'motor-decision';
import { ConsoleAdapter } from './infrastructure/adapters/ConsoleAdapter';
import { WhatsAppAdapter } from './infrastructure/adapters/WhatsAppAdapter';
import { CsvLeadRepository } from './infrastructure/repositories/CsvLeadRepository';
import { GoogleSheetsLeadRepository } from './infrastructure/repositories/GoogleSheetsLeadRepository';
import { CompositeLeadRepository } from './infrastructure/repositories/CompositeLeadRepository';
import { LeadRepository } from './domain/LeadRepository';
import * as path from 'path';

async function main() {
    let config;
    try {
        config = loadConfig();
    } catch (e: any) {
        console.error(`❌ ${e.message}`);
        process.exit(1);
    }

    console.log(`Cargando configuración... Interface: ${config.interface}, Entrada: ${config.inputAdapter}, Almacenamiento: ${config.leadsStorage.type}`);

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

    let leadRepo: LeadRepository;
    const csvRepo = new CsvLeadRepository('./data');
    const googleSheetsRepo = new GoogleSheetsLeadRepository({
        spreadsheetId: config.leadsStorage.googleSheets?.spreadsheetId,
        clientEmail: config.leadsStorage.googleSheets?.clientEmail,
        privateKey: config.leadsStorage.googleSheets?.privateKey,
        sheetContactoName: config.leadsStorage.googleSheets?.sheetContactoName,
        sheetListaEsperaName: config.leadsStorage.googleSheets?.sheetListaEsperaName,
        webhookUrl: config.leadsStorage.googleSheets?.webhookUrl
    });

    if (config.leadsStorage.type === 'google_sheets') {
        leadRepo = googleSheetsRepo;
    } else if (config.leadsStorage.type === 'composite') {
        leadRepo = new CompositeLeadRepository([csvRepo, googleSheetsRepo]);
    } else {
        leadRepo = csvRepo;
    }

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
