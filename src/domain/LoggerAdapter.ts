export interface LoggerAdapter {
  /**
   * Registra eventos informativos o de sistema
   */
  logSystem(context: string, message: string, extraData?: any): void;

  /**
   * Registra y maneja errores ocurridos en la aplicación
   */
  handleError(context: string, error: any, extraData?: any): void;
}
