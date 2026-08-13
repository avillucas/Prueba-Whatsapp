import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
    interface: 'command' | 'baileys';
    inputAdapter: 'file'; // can be extended to 'api', 'db', etc.
    mockupFilePath: string;
    leadsStorage: {
        type: 'csv';
        filePath: string;
    };
}

export function loadConfig(): AppConfig {
    const configPath = path.resolve(process.cwd(), 'src/config.json');
    try {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(fileContent) as AppConfig;
    } catch (error) {
        console.error("Error al cargar la configuración. Usando valores por defecto.");
        return {
            interface: 'command',
            inputAdapter: 'file',
            mockupFilePath: 'src/mockup.json',
            leadsStorage: {
                type: 'csv',
                filePath: 'leads.csv'
            }
        };
    }
}
