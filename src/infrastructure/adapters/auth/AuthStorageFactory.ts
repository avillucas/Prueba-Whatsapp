import { AuthStorageAdapter } from '../../../domain/AuthStorageAdapter';
import { FileAuthAdapter } from './FileAuthAdapter';
import { GoogleAuthAdapter } from './GoogleAuthAdapter';
import { AppConfig } from '../../../config/config';

export type AuthStorageType = 'file' | 'google' | 'gcs' | string;

export class AuthStorageFactory {
  /**
   * Crea e instancia el AuthStorageAdapter adecuado según el tipo o variables de entorno.
   * Por defecto usa 'file' (FileAuthAdapter).
   *
   * @param storageType Tipo de adaptador ('file' | 'google' | 'gcs'). Por defecto 'file'.
   * @param config Configuración de la aplicación que incluye authStorage y credenciales.
   */
  public static create(storageType?: AuthStorageType, config?: AppConfig): AuthStorageAdapter {
    const rawType = storageType || config?.authStorage?.type || process.env.AUTH_STORAGE_TYPE || process.env.AUTH_ADAPTER || 'file';
    const type = rawType.toLowerCase().trim();

    const authDir = config?.authStorage?.authDir || process.env.AUTH_DIR || './auth_info';

    if (type === 'google' || type === 'gcs') {
      const bucketName = config?.authStorage?.bucketName || process.env.GCS_BUCKET_NAME || process.env.GOOGLE_STORAGE_BUCKET || 'whatsapp-bot-auth';
      const clientEmail = config?.leadsStorage?.googleSheets?.clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = config?.leadsStorage?.googleSheets?.privateKey || process.env.GOOGLE_PRIVATE_KEY;

      return new GoogleAuthAdapter({
        bucketName,
        localDir: authDir,
        clientEmail,
        privateKey
      });
    }

    // Por defecto usa FileAuthAdapter
    return new FileAuthAdapter(authDir);
  }
}

export function createAuthStorageAdapter(storageType?: AuthStorageType, config?: AppConfig): AuthStorageAdapter {
  return AuthStorageFactory.create(storageType, config);
}
