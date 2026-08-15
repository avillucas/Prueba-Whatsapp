import { LoggerAdapter } from '../../domain/LoggerAdapter';
import { LoggerFactory } from '../adapters/logging/LoggerFactory';
import { FileLoggerAdapter } from '../adapters/logging/FileLoggerAdapter';

export class ErrorHandler {
  private static adapter: LoggerAdapter = LoggerFactory.create();

  public static setAdapter(adapter: LoggerAdapter): void {
    this.adapter = adapter;
  }

  public static getAdapter(): LoggerAdapter {
    return this.adapter;
  }

  public static setLogDirectory(dir: string): void {
    if (this.adapter instanceof FileLoggerAdapter) {
      this.adapter.setLogDirectory(dir);
    } else {
      const fileAdapter = new FileLoggerAdapter(dir);
      this.adapter = fileAdapter;
    }
  }

  public static getErrorLogFilePath(): string {
    if (this.adapter instanceof FileLoggerAdapter) {
      return this.adapter.getErrorLogFilePath();
    }
    return '';
  }

  public static getSystemLogFilePath(): string {
    if (this.adapter instanceof FileLoggerAdapter) {
      return this.adapter.getSystemLogFilePath();
    }
    return '';
  }

  /**
   * Registra y maneja errores usando el adaptador de logging configurado.
   */
  public static handle(context: string, error: any, extraData?: any): void {
    this.adapter.handleError(context, error, extraData);
  }

  /**
   * Registra mensajes informativos y de sistema usando el adaptador de logging configurado.
   */
  public static logSystem(context: string, message: string, extraData?: any): void {
    this.adapter.logSystem(context, message, extraData);
  }
}
