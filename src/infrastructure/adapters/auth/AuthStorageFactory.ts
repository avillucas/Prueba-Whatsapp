import { AuthStorageAdapter } from '../../../domain/AuthStorageAdapter';
import { RedisAuthAdapter } from './RedisAuthAdapter';
import { FirestoreAuthAdapter } from './FirestoreAuthAdapter';
import { AppConfig } from '../../../config/config';

export type AuthStorageType = 'redis' | 'firestore' | 'gcf' | string;

export class AuthStorageFactory {
  /**
   * Crea e instancia el AuthStorageAdapter adecuado según el tipo o variables de entorno.
   * Entorno local: 'redis' (RedisAuthAdapter).
   * Entorno producción: 'firestore' / 'gcf' (FirestoreAuthAdapter).
   *
   * @param storageType Tipo de adaptador ('redis' | 'firestore' | 'gcf').
   * @param config Configuración de la aplicación que incluye authStorage y credenciales.
   */
  public static create(storageType?: AuthStorageType, config?: AppConfig): AuthStorageAdapter {
    const rawType = storageType || config?.authStorage?.type || process.env.AUTH_STORAGE_TYPE || process.env.AUTH_ADAPTER || 'redis';
    const type = rawType.toLowerCase().trim();

    if (type === 'firestore' || type === 'firebase' || type === 'firebase_firestore' || type === 'gcf' || type === 'google_firestore' || type === 'google') {
      const collectionName = config?.authStorage?.firestore?.collectionName || process.env.FIRESTORE_COLLECTION_NAME || 'whatsapp_auth';
      const projectId = config?.authStorage?.firestore?.projectId || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
      const databaseId = config?.authStorage?.firestore?.databaseId || process.env.FIRESTORE_DATABASE_ID || process.env.DATABASE;
      const clientEmail = config?.leadsStorage?.googleSheets?.clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = config?.leadsStorage?.googleSheets?.privateKey || process.env.GOOGLE_PRIVATE_KEY;
      const localDir = config?.authStorage?.authDir || process.env.AUTH_DIR || './auth_info';

      return new FirestoreAuthAdapter({
        collectionName,
        projectId,
        databaseId,
        clientEmail,
        privateKey,
        localDir
      });
    }

    // Por defecto en desarrollo local usa RedisAuthAdapter
    const host = config?.authStorage?.redis?.host || process.env.REDIS_HOST || 'localhost';
    const port = config?.authStorage?.redis?.port || Number(process.env.REDIS_PORT) || 6379;
    const password = config?.authStorage?.redis?.password || process.env.REDIS_PASSWORD;
    const db = config?.authStorage?.redis?.db !== undefined ? config.authStorage.redis.db : Number(process.env.REDIS_DB || 0);
    const localDir = config?.authStorage?.authDir || process.env.AUTH_DIR || './auth_info';

    return new RedisAuthAdapter({
      host,
      port,
      password,
      db,
      localDir
    });
  }
}

export function createAuthStorageAdapter(storageType?: AuthStorageType, config?: AppConfig): AuthStorageAdapter {
  return AuthStorageFactory.create(storageType, config);
}
