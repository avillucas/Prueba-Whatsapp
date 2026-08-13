import { loadConfig } from './config';
import { loadMockupFromJson } from './jsonAdapter';
import { startCommandInterface } from './interfaces/commandInterface';
import { startBaileysInterface } from './interfaces/baileysInterface';
import { DecisionNode } from 'motor-decision';
// Si el adaptador de entrada cambia (ej. a una base de datos), se puede agregar la lógica aquí.

async function main() {
    const config = loadConfig();
    console.log(`Cargando configuración... Interface: ${config.interface}, Entrada: ${config.inputAdapter}`);

    let nodes: DecisionNode[] = [];

    // Selección de adaptador de entrada
    if (config.inputAdapter === 'file') {
        try {
            nodes = loadMockupFromJson(config.mockupFilePath);
            console.log(`Mockup cargado desde ${config.mockupFilePath}`);
        } catch (e) {
            console.error("Error crítico al cargar los datos del mockup. Abortando.");
            process.exit(1);
        }
    } else {
        console.error(`Adaptador de entrada '${config.inputAdapter}' no soportado aún.`);
        process.exit(1);
    }

    // Selección de interfaz
    if (config.interface === 'command') {
        startCommandInterface(config, nodes);
    } else if (config.interface === 'baileys') {
        await startBaileysInterface(config, nodes);
    } else {
        console.error(`Interface '${config.interface}' no configurada correctamente.`);
        process.exit(1);
    }
}

main();
