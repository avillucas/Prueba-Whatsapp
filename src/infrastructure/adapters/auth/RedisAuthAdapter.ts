import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { AuthStorageAdapter } from '../../../domain/AuthStorageAdapter';
import { ErrorHandler } from '../../logging/ErrorHandler';

export interface RedisAuthAdapterOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  localDir?: string;
}

export class RedisAuthAdapter implements AuthStorageAdapter {
  private redis: Redis;
  private keyPrefix: string;
  private localDir: string;

  constructor(options: RedisAuthAdapterOptions = {}) {
    const host = options.host || process.env.REDIS_HOST || 'localhost';
    const port = options.port || Number(process.env.REDIS_PORT) || 6379;
    const password = options.password || process.env.REDIS_PASSWORD || undefined;
    const db = options.db !== undefined ? options.db : Number(process.env.REDIS_DB || 0);

    this.keyPrefix = options.keyPrefix || process.env.REDIS_KEY_PREFIX || 'whatsapp_auth';
    this.localDir = options.localDir || process.env.AUTH_DIR || './auth_info';

    this.redis = new Redis({
      host,
      port,
      password,
      db,
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'wait' || this.redis.status === 'close') {
      await this.redis.connect();
    }
  }

  async beforeAuth(): Promise<void> {
    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }

    try {
      await this.ensureConnected();
      ErrorHandler.logSystem('RedisAuthAdapter', `Consultando credenciales en Redis (Hash: '${this.keyPrefix}')...`);
      
      const authData = await this.redis.hgetall(this.keyPrefix);
      const keys = Object.keys(authData);

      // Limpiamos los archivos del directorio temporal previo para asegurar sincronización exacta
      const existingLocalFiles = fs.readdirSync(this.localDir);
      for (const file of existingLocalFiles) {
        const fullPath = path.join(this.localDir, file);
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
        }
      }

      if (keys.length === 0) {
        ErrorHandler.logSystem('RedisAuthAdapter', `No se encontraron credenciales en Redis (Hash: '${this.keyPrefix}'). Se iniciará sesión limpia.`);
        return;
      }

      let count = 0;
      for (const fileName of keys) {
        const fileContent = authData[fileName];
        if (fileContent !== undefined) {
          const filePath = path.join(this.localDir, fileName);
          fs.writeFileSync(filePath, fileContent, 'utf-8');
          count++;
        }
      }

      ErrorHandler.logSystem('RedisAuthAdapter', `Sesión descargada exitosamente desde Redis (${count} archivos cargados en '${this.localDir}').`);
    } catch (error: any) {
      ErrorHandler.logSystem('RedisAuthAdapter', `Aviso al conectar con Redis: ${error.message}. Continuando con directorio temporal.`);
    }
  }

  async afterSaveCreds(): Promise<void> {
    try {
      if (!fs.existsSync(this.localDir)) return;
      await this.ensureConnected();

      const files = fs.readdirSync(this.localDir);
      const pipeline = this.redis.pipeline();

      const currentDiskFiles = new Set<string>();

      for (const fileName of files) {
        const filePath = path.join(this.localDir, fileName);
        if (fs.statSync(filePath).isFile()) {
          currentDiskFiles.add(fileName);
          const content = fs.readFileSync(filePath, 'utf-8');
          pipeline.hset(this.keyPrefix, fileName, content);
        }
      }

      // Eliminar de Redis archivos que ya no existan localmente
      const redisKeys = Object.keys(await this.redis.hgetall(this.keyPrefix));
      for (const rKey of redisKeys) {
        if (!currentDiskFiles.has(rKey)) {
          pipeline.hdel(this.keyPrefix, rKey);
        }
      }

      await pipeline.exec();
      ErrorHandler.logSystem('RedisAuthAdapter', `Credenciales de sesión sincronizadas exitosamente en Redis (Hash: '${this.keyPrefix}').`);
    } catch (error: any) {
      ErrorHandler.handle('RedisAuthAdapter', error, { keyPrefix: this.keyPrefix });
    }
  }

  getAuthDir(): string {
    return this.localDir;
  }

  async disconnect(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }
}
