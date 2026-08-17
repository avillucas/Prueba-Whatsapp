import * as fs from 'fs';
import * as path from 'path';

export interface GoogleSheetsConfig {
    spreadsheetId?: string;
    clientEmail?: string;
    privateKey?: string;
    sheetContactoName?: string;
    sheetListaEsperaName?: string;
}

export interface RedisConfig {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
}

export interface FirestoreConfig {
    collectionName?: string;
    projectId?: string;
}

export interface AuthStorageConfig {
    type: 'redis' | 'firestore' | 'gcf' | 'google' | string;
    authDir?: string;
    bucketName?: string;
    redis?: RedisConfig;
    firestore?: FirestoreConfig;
}

export interface LoggingConfig {
    type: 'file' | 'gcp' | 'google' | 'console';
    logDir?: string;
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
    authStorage?: AuthStorageConfig;
    loggingStorage?: LoggingConfig;
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
                filePath: 'data',
                googleSheets: {
                    sheetContactoName: 'Contactos',
                    sheetListaEsperaName: 'ListaEspera'
                }
            },
            authStorage: {
                type: 'redis',
                authDir: './auth_info',
                redis: {
                    host: 'redis',
                    port: 6379
                },
                firestore: {
                    collectionName: 'whatsapp_auth'
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

    // Inicializar sub-objeto authStorage si no existe
    if (!config.authStorage) {
        config.authStorage = {
            type: 'redis',
            authDir: './auth_info'
        };
    }

    if (process.env.AUTH_STORAGE_TYPE || process.env.AUTH_ADAPTER) {
        const authType = (process.env.AUTH_STORAGE_TYPE || process.env.AUTH_ADAPTER || '').toLowerCase().trim();
        if (authType === 'redis' || authType === 'firestore' || authType === 'firebase' || authType === 'firebase_firestore' || authType === 'gcf' || authType === 'google_firestore' || authType === 'google') {
            config.authStorage.type = authType as any;
        }
    }

    if (process.env.AUTH_DIR) {
        config.authStorage.authDir = process.env.AUTH_DIR;
    }

    if (process.env.GCS_BUCKET_NAME) {
        config.authStorage.bucketName = process.env.GCS_BUCKET_NAME;
    }

    if (!config.authStorage.redis) {
        config.authStorage.redis = {};
    }
    config.authStorage.redis.host = process.env.REDIS_HOST || config.authStorage.redis.host || 'redis';
    config.authStorage.redis.port = Number(process.env.REDIS_PORT) || config.authStorage.redis.port || 6379;
    config.authStorage.redis.password = process.env.REDIS_PASSWORD || config.authStorage.redis.password;

    if (!config.authStorage.firestore) {
        config.authStorage.firestore = {};
    }
    config.authStorage.firestore.collectionName = process.env.FIRESTORE_COLLECTION_NAME || config.authStorage.firestore.collectionName || 'whatsapp_auth';
    config.authStorage.firestore.projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || config.authStorage.firestore.projectId;

    // Inicializar sub-objeto loggingStorage si no existe
    if (!config.loggingStorage) {
        config.loggingStorage = {
            type: 'file',
            logDir: './logs'
        };
    }

    if (process.env.LOG_ADAPTER || process.env.LOG_TYPE) {
        const logType = (process.env.LOG_ADAPTER || process.env.LOG_TYPE || '').toLowerCase().trim();
        if (logType === 'file' || logType === 'gcp' || logType === 'google' || logType === 'console') {
            config.loggingStorage.type = logType as any;
        }
    }

    if (process.env.LOG_DIR) {
        config.loggingStorage.logDir = process.env.LOG_DIR;
    } else if (!config.loggingStorage.logDir) {
        config.loggingStorage.logDir = './logs';
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

    // Nombres de hojas con valores por defecto a menos que se hayan ingresado
    gs.sheetContactoName = process.env.GOOGLE_SHEETS_TAB_CONTACTOS || gs.sheetContactoName || 'Contactos';
    gs.sheetListaEsperaName = process.env.GOOGLE_SHEETS_TAB_LISTA_ESPERA || gs.sheetListaEsperaName || 'ListaEspera';

    // Validación de credenciales obligatorias si Google Sheets está activo
    const storageType = (config.leadsStorage.type || '').toLowerCase();
    if (storageType === 'google_sheets' || storageType === 'googlesheet' || storageType === 'composite') {
        const hasServiceAccount = Boolean(
            gs.spreadsheetId && gs.spreadsheetId.trim() !== '' &&
            gs.clientEmail && gs.clientEmail.trim() !== '' &&
            gs.privateKey && gs.privateKey.trim() !== ''
        );

        if (!hasServiceAccount) {
            const missingParams: string[] = [];
            if (!gs.spreadsheetId) missingParams.push("spreadsheetId (o GOOGLE_SPREADSHEET_ID)");
            if (!gs.clientEmail) missingParams.push("clientEmail (o GOOGLE_SERVICE_ACCOUNT_EMAIL)");
            if (!gs.privateKey) missingParams.push("privateKey (o GOOGLE_PRIVATE_KEY)");

            throw new Error(
                `[ConfigError] Google Sheets está activo ('${config.leadsStorage.type}') pero faltan los datos de autenticación obligatorios: ${missingParams.join(', ')}.`
            );
        }
    }

    return config;
}
