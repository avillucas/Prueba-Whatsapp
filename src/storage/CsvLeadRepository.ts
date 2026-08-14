import * as fs from 'fs';
import * as path from 'path';
import { LeadRepository } from './LeadRepository';
import { LeadContacto, LeadListaEspera } from './Lead';

export class CsvLeadRepository implements LeadRepository {
  private contactoPath: string;
  private listaEsperaPath: string;

  constructor(dataDirectory: string = './leads_data') {
    if (!fs.existsSync(dataDirectory)) {
      fs.mkdirSync(dataDirectory, { recursive: true });
    }
    this.contactoPath = path.join(dataDirectory, 'contactos.csv');
    this.listaEsperaPath = path.join(dataDirectory, 'lista_espera.csv');
    this.initializeFiles();
  }

  private initializeFiles() {
    if (!fs.existsSync(this.contactoPath)) {
      fs.writeFileSync(this.contactoPath, 'sessionId,nombre,telefono,correoElectronico,mensaje\n', 'utf-8');
    }
    if (!fs.existsSync(this.listaEsperaPath)) {
      fs.writeFileSync(this.listaEsperaPath, 'sessionId,nombre,telefono,cursoDeInteres\n', 'utf-8');
    }
  }

  private escapeCsv(value: string): string {
    // Escapar comillas dobles y envolver en comillas si contiene comas, saltos de línea o comillas
    const escaped = value.replace(/"/g, '""');
    if (escaped.search(/("|,|\n)/g) >= 0) {
      return `"${escaped}"`;
    }
    return escaped;
  }

  async saveContacto(sessionId: string, lead: LeadContacto): Promise<void> {
    const row = [
      sessionId,
      lead.nombre || '',
      lead.telefono?.numeroCompleto || '',
      lead.correoElectronico?.valor || '',
      lead.mensaje || ''
    ].map(val => this.escapeCsv(val)).join(',');

    await fs.promises.appendFile(this.contactoPath, `${row}\n`, 'utf-8');
  }

  async saveListaEspera(sessionId: string, lead: LeadListaEspera): Promise<void> {
    const row = [
      sessionId,
      lead.nombre || '',
      lead.telefono?.numeroCompleto || '',
      lead.cursoDeInteres || ''
    ].map(val => this.escapeCsv(val)).join(',');

    await fs.promises.appendFile(this.listaEsperaPath, `${row}\n`, 'utf-8');
  }
}
