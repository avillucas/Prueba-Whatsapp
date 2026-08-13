import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from '../config';

export function saveLead(config: AppConfig, userId: string, key: string, value: string) {
    if (config.leadsStorage.type !== 'csv') {
        console.warn(`Tipo de almacenamiento de leads no soportado: ${config.leadsStorage.type}`);
        return;
    }

    const filePath = path.resolve(process.cwd(), config.leadsStorage.filePath);
    const dirPath = path.dirname(filePath);
    const date = new Date().toISOString();
    
    // Si el directorio no existe, lo creamos
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Si el archivo no existe, creamos la cabecera
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, 'Date,UserID,Key,Value\n', 'utf-8');
    }

    // Escapamos los valores para el CSV simple
    const escapedValue = `"${value.replace(/"/g, '""')}"`;
    const line = `${date},${userId},${key},${escapedValue}\n`;

    fs.appendFileSync(filePath, line, 'utf-8');
}
