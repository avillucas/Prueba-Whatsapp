import { LoggerAdapter } from '../../../domain/LoggerAdapter';

export class GCPLoggerAdapter implements LoggerAdapter {
  public handleError(context: string, error: any, extraData?: any): void {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.stack || error.message : String(error);

    const gcpLogEntry = {
      severity: 'ERROR',
      timestamp,
      context,
      message: `[${context}] ERROR: ${error instanceof Error ? error.message : String(error)}`,
      error: errorMessage,
      ...(extraData ? { extraData } : {})
    };

    process.stderr.write(JSON.stringify(gcpLogEntry) + '\n');
  }

  public logSystem(context: string, message: string, extraData?: any): void {
    const timestamp = new Date().toISOString();

    const gcpLogEntry = {
      severity: 'INFO',
      timestamp,
      context,
      message: `[${context}] INFO: ${message}`,
      ...(extraData ? { extraData } : {})
    };

    process.stdout.write(JSON.stringify(gcpLogEntry) + '\n');
  }
}
