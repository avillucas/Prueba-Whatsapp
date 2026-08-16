import * as fs from 'fs';
import * as path from 'path';
import { LoggerAdapter } from '../../../domain/LoggerAdapter';

export class FileLoggerAdapter implements LoggerAdapter {
  private logDirectory: string;
  private errorLogFilePath: string;
  private systemLogFilePath: string;

  constructor(logDirectory: string = path.join(process.cwd(), 'logs')) {
    this.logDirectory = logDirectory;
    this.errorLogFilePath = path.join(this.logDirectory, 'errors.log');
    this.systemLogFilePath = path.join(this.logDirectory, 'system.log');
    this.ensureLogFiles();
  }

  public setLogDirectory(dir: string): void {
    this.logDirectory = dir;
    this.errorLogFilePath = path.join(dir, 'errors.log');
    this.systemLogFilePath = path.join(dir, 'system.log');
    this.ensureLogFiles();
  }

  public getErrorLogFilePath(): string {
    return this.errorLogFilePath;
  }

  public getSystemLogFilePath(): string {
    return this.systemLogFilePath;
  }

  private ensureLogFiles(): void {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
      if (!fs.existsSync(this.errorLogFilePath)) {
        fs.writeFileSync(this.errorLogFilePath, '', 'utf-8');
      }
      if (!fs.existsSync(this.systemLogFilePath)) {
        fs.writeFileSync(this.systemLogFilePath, '', 'utf-8');
      }
    } catch (_err) {
      // Ignorar fallos de I/O en disco
    }
  }

  private ensureLogDirectory(): void {
    this.ensureLogFiles();
  }

  public handleError(context: string, error: any, extraData?: any): void {
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

  public logSystem(context: string, message: string, extraData?: any): void {
    try {
      this.ensureLogDirectory();
      const timestamp = new Date().toISOString();
      const dataStr = extraData ? ` | Details: ${JSON.stringify(extraData)}` : '';
      const logLine = `[${timestamp}] [${context}] INFO: ${message}${dataStr}\n`;

      fs.appendFileSync(this.systemLogFilePath, logLine, 'utf-8');
    } catch (_err) {
      // Ignorar fallos de I/O en disco
    }
  }
}
