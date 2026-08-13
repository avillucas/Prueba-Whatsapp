import * as fs from 'fs';
import * as path from 'path';
import { DecisionNode } from 'motor-decision';

/**
 * Carga los datos de un archivo JSON y los convierte en el formato DecisionNode[]
 * esperado por la librería motor-decision.
 *
 * @param jsonFilePath Ruta relativa o absoluta al archivo JSON
 * @returns Un array de DecisionNode
 */
export function loadMockupFromJson(jsonFilePath: string): DecisionNode[] {
    const absolutePath = path.resolve(process.cwd(), jsonFilePath);
    try {
        const fileContent = fs.readFileSync(absolutePath, 'utf-8');
        const nodes: DecisionNode[] = JSON.parse(fileContent);
        return nodes;
    } catch (error) {
        console.error(`Error leyendo o parseando el archivo JSON: ${absolutePath}`);
        throw error;
    }
}
