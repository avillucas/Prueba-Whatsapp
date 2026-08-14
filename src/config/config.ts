import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
    interface: 'command' | 'baileys';
    inputAdapter: 'file'; // can be extended to 'api', 'db', etc.
    flowFile: string;
    leadsStorage: {
        type: 'csv';
        filePath: string;
    };
}

export function loadConfig(): AppConfig {
    const configPath = path.resolve(process.cwd(), 'src/config/config.json');
    let config: AppConfig;
    try {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(fileContent) as AppConfig;
    } catch (error) {
        console.error("Error al cargar la configuración. Usando valores por defecto.");
        config = {
            interface: 'command',
            inputAdapter: 'file',
            flowFile: 'flow_cfp412.json',
            leadsStorage: {
                type: 'csv',
                filePath: 'data/leads.csv'
            }
        };
    }

    if (process.env.INTERFACE === 'command' || process.env.INTERFACE === 'baileys') {
        config.interface = process.env.INTERFACE;
    }

    if (process.env.FLOW_FILE) {
        config.flowFile = process.env.FLOW_FILE;
    }

    return config;
}
