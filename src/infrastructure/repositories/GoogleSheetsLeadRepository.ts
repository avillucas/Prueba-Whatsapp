import { LeadRepository } from '../../domain/LeadRepository';
import { LeadContacto, LeadListaEspera } from '../../domain/Lead';
import { GoogleSheetsAdapter, GoogleSheetsAdapterConfig } from '../adapters/GoogleSheetsAdapter';

export interface GoogleSheetsLeadRepoConfig extends GoogleSheetsAdapterConfig {
  sheetContactoName?: string;
  sheetListaEsperaName?: string;
}

export class GoogleSheetsLeadRepository implements LeadRepository {
  private adapter: GoogleSheetsAdapter;
  public readonly sheetContactoName: string;
  public readonly sheetListaEsperaName: string;

  constructor(config: GoogleSheetsLeadRepoConfig = {}, adapter?: GoogleSheetsAdapter) {
    this.adapter = adapter || new GoogleSheetsAdapter(config);
    // Utiliza valores por defecto ("Contactos" y "ListaEspera") a menos que los ingresen
    this.sheetContactoName = config.sheetContactoName || process.env.GOOGLE_SHEETS_TAB_CONTACTOS || 'Contactos';
    this.sheetListaEsperaName = config.sheetListaEsperaName || process.env.GOOGLE_SHEETS_TAB_LISTA_ESPERA || 'ListaEspera';
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Escribe un LeadContacto en la hoja configurada (default: 'Contactos')
   */
  async saveContacto(sessionId: string, lead: LeadContacto): Promise<void> {
    const timestamp = this.getTimestamp();
    const row = [
      timestamp,
      sessionId,
      lead.nombre || '',
      lead.telefono?.numeroCompleto || '',
      lead.correoElectronico?.valor || '',
      lead.mensaje || ''
    ];

    await this.adapter.appendRow(this.sheetContactoName, row);
  }

  /**
   * Escribe un LeadListaEspera en la hoja configurada (default: 'ListaEspera')
   */
  async saveListaEspera(sessionId: string, lead: LeadListaEspera): Promise<void> {
    const timestamp = this.getTimestamp();
    const row = [
      timestamp,
      sessionId,
      lead.nombre || '',
      lead.telefono?.numeroCompleto || '',
      (lead as any).correoElectronico?.valor || '',
      lead.cursoDeInteres || ''
    ];

    await this.adapter.appendRow(this.sheetListaEsperaName, row);
  }

  /**
   * Lee las filas de la hoja de contactos
   */
  async getContactos(): Promise<string[][]> {
    return this.adapter.readRows(this.sheetContactoName);
  }

  /**
   * Lee las filas de la hoja de lista de espera
   */
  async getListaEspera(): Promise<string[][]> {
    return this.adapter.readRows(this.sheetListaEsperaName);
  }
}
