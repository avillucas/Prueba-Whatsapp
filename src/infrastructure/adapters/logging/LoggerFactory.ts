import { LoggerAdapter } from '../../../domain/LoggerAdapter';
import { FileLoggerAdapter } from './FileLoggerAdapter';
import { GCPLoggerAdapter } from './GCPLoggerAdapter';
import { AppConfig } from '../../../config/config';

export type LoggerAdapterType = 'file' | 'gcp' | 'google' | 'cloud' | string;

export class LoggerFactory {
  /**
   * Instancia y retorna el LoggerAdapter correspondiente según el tipo especificado
   * o variables de entorno (LOG_ADAPTER / LOG_TYPE).
   */
  public static create(type?: LoggerAdapterType, config?: AppConfig): LoggerAdapter {
    const rawType = type || config?.loggingStorage?.type || process.env.LOG_ADAPTER || process.env.LOG_TYPE || 'file';
    const normalizedType = rawType.toLowerCase().trim();

    if (normalizedType === 'gcp' || normalizedType === 'google' || normalizedType === 'cloud') {
      return new GCPLoggerAdapter();
    }

    const logDir = config?.loggingStorage?.logDir || process.env.LOG_DIR || undefined;
    return new FileLoggerAdapter(logDir);
  }
}
