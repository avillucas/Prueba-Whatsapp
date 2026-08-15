import * as fs from 'fs';
import { AuthStorageAdapter } from '../../../domain/AuthStorageAdapter';
import { ErrorHandler } from '../../logging/ErrorHandler';

export class FileAuthAdapter implements AuthStorageAdapter {
  private authDir: string;

  constructor(authDir: string = './auth_info') {
    this.authDir = authDir;
  }

  async beforeAuth(): Promise<void> {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
      ErrorHandler.logSystem('FileAuthAdapter', `Directorio de sesión '${this.authDir}' creado localmente.`);
    } else {
      ErrorHandler.logSystem('FileAuthAdapter', `Usando directorio de sesión local existente '${this.authDir}'.`);
    }
  }

  async afterSaveCreds(): Promise<void> {
    // Para el almacenamiento en archivos locales, Baileys ya guardó el estado directamente en el disco.
    ErrorHandler.logSystem('FileAuthAdapter', 'Credenciales actualizadas en el almacenamiento local.');
  }

  getAuthDir(): string {
    return this.authDir;
  }
}
