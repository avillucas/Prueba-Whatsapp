import { LeadRepository } from '../../domain/LeadRepository';
import { CsvLeadRepository } from './CsvLeadRepository';
import { GoogleSheetsLeadRepository } from './GoogleSheetsLeadRepository';
import { CompositeLeadRepository } from './CompositeLeadRepository';
import { AppConfig } from '../../config/config';

export type LeadStorageType = 'csv' | 'google_sheets' | 'googlesheet' | 'composite' | string;

export class LeadRepositoryFactory {
  /**
   * Crea e instancia un LeadRepository según el tipo de almacenamiento especificado.
   * Toma por defecto 'csv' a menos que se especifique 'google_sheets' / 'googlesheet' o 'composite'.
   *
   * @param storageType Tipo de almacenamiento ('csv' | 'google_sheets' | 'googlesheet' | 'composite'). Por defecto 'csv'.
   * @param config Configuración de la aplicación que incluye las credenciales de Google Sheets y rutas.
   */
  public static create(storageType: LeadStorageType = 'csv', config?: AppConfig): LeadRepository {
    const type = (storageType || 'csv').toLowerCase().trim();

    if (type === 'google_sheets' || type === 'googlesheet') {
      const gsConfig = config?.leadsStorage?.googleSheets || {};
      return new GoogleSheetsLeadRepository({
        spreadsheetId: gsConfig.spreadsheetId,
        clientEmail: gsConfig.clientEmail,
        privateKey: gsConfig.privateKey,
        sheetContactoName: gsConfig.sheetContactoName,
        sheetListaEsperaName: gsConfig.sheetListaEsperaName
      });
    }

    if (type === 'composite') {
      const csvPath = config?.leadsStorage?.filePath || './data';
      const csvRepo = new CsvLeadRepository(csvPath);
      const gsConfig = config?.leadsStorage?.googleSheets || {};
      const gsRepo = new GoogleSheetsLeadRepository({
        spreadsheetId: gsConfig.spreadsheetId,
        clientEmail: gsConfig.clientEmail,
        privateKey: gsConfig.privateKey,
        sheetContactoName: gsConfig.sheetContactoName,
        sheetListaEsperaName: gsConfig.sheetListaEsperaName
      });

      return new CompositeLeadRepository([csvRepo, gsRepo]);
    }

    // Por defecto se retorna CsvLeadRepository
    const dataDir = config?.leadsStorage?.filePath || './data';
    return new CsvLeadRepository(dataDir);
  }
}

/**
 * Función helper para instanciar el repositorio de leads
 */
export function createLeadRepository(storageType: LeadStorageType = 'csv', config?: AppConfig): LeadRepository {
  return LeadRepositoryFactory.create(storageType, config);
}
