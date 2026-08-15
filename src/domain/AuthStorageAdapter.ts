export interface AuthStorageAdapter {
  /**
   * Prepara el entorno antes de inicializar useMultiFileAuthState (ej. descarga desde GCS o asegura directorio local)
   */
  beforeAuth(): Promise<void>;

  /**
   * Se ejecuta luego de cada 'creds.update' guardando el estado actualizado (ej. sube cambios a GCS o noop en local)
   */
  afterSaveCreds(): Promise<void>;

  /**
   * Retorna la ruta al directorio local utilizado para almacenar temporalmente los archivos de sesión
   */
  getAuthDir(): string;
}
