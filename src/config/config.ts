import * as fs from 'fs';
import * as path from 'path';

export interface GoogleSheetsConfig {
    spreadsheetId?: string;
    clientEmail?: string;
    privateKey?: string;
    webhookUrl?: string;
    sheetContactoName?: string;
    sheetListaEsperaName?: string;
}

export interface AppConfig {
    interface: 'command' | 'baileys';
    inputAdapter: 'file';
    flowFile: string;
    leadsStorage: {
        type: 'csv' | 'google_sheets' | 'googlesheet' | 'composite';
        filePath?: string;
        googleSheets?: GoogleSheetsConfig;
    };
}

export function loadConfig(): AppConfig {
    const configPath = path.resolve(process.cwd(), 'src/config/config.json');
    let config: AppConfig;
    try {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(fileContent) as AppConfig;
    } catch (error) {
        console.error("Error al cargar el archivo de configuración. Usando valores por defecto.");
        config = {
            interface: 'command',
            inputAdapter: 'file',
            flowFile: 'flow_cfp412.json',
            leadsStorage: {
                type: 'csv',
                filePath: 'data/leads.csv',
                googleSheets: {
                    sheetContactoName: 'Contactos',
                    sheetListaEsperaName: 'ListaEspera'
                }
            }
        };
    }

    // Sobrescribir con Variables de Entorno si existen
    if (process.env.INTERFACE === 'command' || process.env.INTERFACE === 'baileys') {
        config.interface = process.env.INTERFACE;
    }

    if (process.env.FLOW_FILE) {
        config.flowFile = process.env.FLOW_FILE;
    }

    if (process.env.LEADS_STORAGE_TYPE) {
        const storageType = process.env.LEADS_STORAGE_TYPE.toLowerCase().trim();
        if (storageType === 'csv' || storageType === 'google_sheets' || storageType === 'googlesheet' || storageType === 'composite') {
            config.leadsStorage.type = storageType as any;
        }
    }

    // Inicializar sub-objeto googleSheets si no existe
    if (!config.leadsStorage.googleSheets) {
        config.leadsStorage.googleSheets = {};
    }

    const gs = config.leadsStorage.googleSheets;

    // Leer valores de Google Sheets desde process.env con fallback a config.json o valores por defecto
    gs.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || gs.spreadsheetId || '';
    gs.clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || gs.clientEmail || '';
    gs.privateKey = process.env.GOOGLE_PRIVATE_KEY || gs.privateKey || '';
    gs.webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL || gs.webhookUrl || '';

    // Nombres de hojas con valores por defecto a menos que se hayan ingresado
    gs.sheetContactoName = process.env.GOOGLE_SHEETS_TAB_CONTACTOS || gs.sheetContactoName || 'Contactos';
    gs.sheetListaEsperaName = process.env.GOOGLE_SHEETS_TAB_LISTA_ESPERA || gs.sheetListaEsperaName || 'ListaEspera';

    // Validación de credenciales obligatorias si Google Sheets está activo
    const storageType = (config.leadsStorage.type || '').toLowerCase();
    if (storageType === 'google_sheets' || storageType === 'googlesheet' || storageType === 'composite') {
        const hasWebhook = Boolean(gs.webhookUrl && gs.webhookUrl.trim() !== '');
        const hasServiceAccount = Boolean(
            gs.spreadsheetId && gs.spreadsheetId.trim() !== '' &&
            gs.clientEmail && gs.clientEmail.trim() !== '' &&
            gs.privateKey && gs.privateKey.trim() !== ''
        );

        if (!hasWebhook && !hasServiceAccount) {
            const missingParams: string[] = [];
            if (!gs.spreadsheetId) missingParams.push("spreadsheetId (o GOOGLE_SPREADSHEET_ID)");
            if (!gs.clientEmail) missingParams.push("clientEmail (o GOOGLE_SERVICE_ACCOUNT_EMAIL)");
            if (!gs.privateKey) missingParams.push("privateKey (o GOOGLE_PRIVATE_KEY)");

            throw new Error(
                `[ConfigError] Google Sheets está activo ('${config.leadsStorage.type}') pero faltan los datos de autenticación obligatorios: ${missingParams.join(', ')} (o bien 'webhookUrl' / GOOGLE_SHEETS_WEBHOOK_URL).`
            );
        }
    }

    return config;
}
