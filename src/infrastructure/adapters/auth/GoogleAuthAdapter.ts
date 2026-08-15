import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import { AuthStorageAdapter } from '../../../domain/AuthStorageAdapter';
import { ErrorHandler } from '../../logging/ErrorHandler';

export interface GoogleAuthAdapterOptions {
  bucketName: string;
  localDir?: string;
  prefix?: string;
  clientEmail?: string;
  privateKey?: string;
}

export class GoogleAuthAdapter implements AuthStorageAdapter {
  private storage: Storage;
  private bucketName: string;
  private localDir: string;
  private prefix: string;

  constructor(options: GoogleAuthAdapterOptions) {
    this.bucketName = options.bucketName;
    this.localDir = options.localDir || './auth_info';
    this.prefix = options.prefix || 'auth_info';

    const storageOptions: any = {};
    if (options.clientEmail && options.privateKey) {
      storageOptions.credentials = {
        client_email: options.clientEmail,
        private_key: options.privateKey.replace(/\\n/g, '\n')
      };
    }

    this.storage = new Storage(storageOptions);
  }

  async beforeAuth(): Promise<void> {
    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }

    try {
      ErrorHandler.logSystem('GoogleAuthAdapter', `Descargando sesión de autenticación desde el bucket GCS '${this.bucketName}'...`);
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({ prefix: `${this.prefix}/` });

      if (files.length === 0) {
        ErrorHandler.logSystem('GoogleAuthAdapter', `No se encontraron archivos previos en GCS (${this.prefix}/). Se iniciará nueva sesión.`);
        return;
      }

      let downloadedCount = 0;
      for (const file of files) {
        const relativeName = file.name.substring(this.prefix.length + 1);
        if (!relativeName) continue;

        const localPath = path.join(this.localDir, relativeName);
        await file.download({ destination: localPath });
        downloadedCount++;
      }

      ErrorHandler.logSystem('GoogleAuthAdapter', `Sesión descargada exitosamente desde GCS (${downloadedCount} archivos).`);
    } catch (error: any) {
      ErrorHandler.logSystem('GoogleAuthAdapter', `Aviso al descargar de GCS: ${error.message}. Continuando con directorio local.`);
    }
  }

  async afterSaveCreds(): Promise<void> {
    try {
      if (!fs.existsSync(this.localDir)) return;

      const files = fs.readdirSync(this.localDir);
      const bucket = this.storage.bucket(this.bucketName);

      for (const fileName of files) {
        const filePath = path.join(this.localDir, fileName);
        if (fs.statSync(filePath).isFile()) {
          const destination = `${this.prefix}/${fileName}`;
          await bucket.upload(filePath, {
            destination: destination,
            resumable: false
          });
        }
      }

      ErrorHandler.logSystem('GoogleAuthAdapter', `Archivos de autenticación sincronizados a GCS bucket '${this.bucketName}'.`);
    } catch (error: any) {
      ErrorHandler.handle('GoogleAuthAdapter', error, { bucketName: this.bucketName });
    }
  }

  getAuthDir(): string {
    return this.localDir;
  }
}
