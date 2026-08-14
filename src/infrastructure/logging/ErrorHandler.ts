import * as fs from 'fs';
import * as path from 'path';

export class ErrorHandler {
  private static logDirectory: string = path.join(process.cwd(), 'data');
  private static errorLogFilePath: string = path.join(process.cwd(), 'data', 'errors.log');
  private static systemLogFilePath: string = path.join(process.cwd(), 'data', 'system.log');

  public static setLogDirectory(dir: string): void {
    this.logDirectory = dir;
    this.errorLogFilePath = path.join(dir, 'errors.log');
    this.systemLogFilePath = path.join(dir, 'system.log');
  }

  public static getErrorLogFilePath(): string {
    return this.errorLogFilePath;
  }

  public static getSystemLogFilePath(): string {
    return this.systemLogFilePath;
  }

  private static ensureLogDirectory() {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  /**
   * Registra y maneja errores escribiéndolos en el archivo de log (errors.log)
   * evitando mostrar detalles ruidosos en la consola.
   */
  public static handle(context: string, error: any, extraData?: any): void {
    try {
      this.ensureLogDirectory();
      const timestamp = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
      const dataStr = extraData ? ` | Details: ${JSON.stringify(extraData)}` : '';
      const logLine = `[${timestamp}] [${context}] ERROR: ${errorMessage}${dataStr}\n`;

      fs.appendFileSync(this.errorLogFilePath, logLine, 'utf-8');
    } catch (_err) {
      // Ignorar fallos de I/O en disco
    }
  }

  /**
   * Registra mensajes informativos y de sistema en el archivo de log (system.log)
   * evitando saturar la consola estándar del usuario.
   */
  public static logSystem(context: string, message: string): void {
    try {
      this.ensureLogDirectory();
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] [${context}] INFO: ${message}\n`;

      fs.appendFileSync(this.systemLogFilePath, logLine, 'utf-8');
    } catch (_err) {
      // Ignorar fallos de I/O en disco
    }
  }
}
