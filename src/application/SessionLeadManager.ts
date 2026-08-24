import { Email, Telefono, LeadContacto, LeadListaEspera } from "../domain/Lead";
import { LeadRepository } from "../domain/LeadRepository";
import { LeadValidator } from "../domain/LeadValidator";

export class SessionLeadManager {
  // Guardamos un diccionario con los datos temporales extraídos de cada sesión
  private sessionData: Map<string, Record<string, string>> = new Map();

  constructor(private leadRepository: LeadRepository) {}

  /**
   * Inicializa la sesión con datos conocidos (ej: teléfono de la conexión de WhatsApp).
   */
  initSession(sessionId: string, initialData?: Record<string, string>) {
    if (!this.sessionData.has(sessionId)) {
      this.sessionData.set(sessionId, {});
    }
    if (initialData) {
      const data = this.sessionData.get(sessionId)!;
      for (const [key, val] of Object.entries(initialData)) {
        if (val && this.validateField(key, val) === null) {
          data[key] = val;
        }
      }
    }
  }

  /**
   * Devuelve un dato previamente almacenado en la sesión.
   */
  getSessionData(sessionId: string, key: string): string | undefined {
    return this.sessionData.get(sessionId)?.[key];
  }

  /**
   * Devuelve todos los datos recolectados para una sesión en particular.
   */
  getAllSessionData(sessionId: string): Record<string, string> | undefined {
    const data = this.sessionData.get(sessionId);
    return data ? { ...data } : undefined;
  }

  /**
   * Determina si un campo de extracción de nodo debe saltearse por ya disponer de un valor válido.
   */
  shouldSkipNode(sessionId: string, extractDataField?: string): boolean {
    if (!extractDataField) return false;
    // Las opciones de menú o acciones de reinicio no deben saltearse automáticamente
    if (extractDataField === 'Opcion_Elegida' || extractDataField === 'Accion_Reinicio') {
      return false;
    }
    return this.hasValidField(sessionId, extractDataField);
  }

  /**
   * Verifica si un campo ya posee un valor válido almacenado en la sesión.
   */
  hasValidField(sessionId: string, key: string): boolean {
    const val = this.getSessionData(sessionId, key);
    return val !== undefined && this.validateField(key, val) === null;
  }

  /**
   * Almacena un dato extraído temporalmente para una sesión.
   */
  addData(sessionId: string, key: string, value: string) {
    if (!this.sessionData.has(sessionId)) {
      this.sessionData.set(sessionId, {});
    }
    const data = this.sessionData.get(sessionId)!;
    data[key] = value;
  }

  /**
   * Valida un campo invocando la lógica de validación de Dominio.
   */
  validateField(key: string, value: string): string | null {
    return LeadValidator.validar(key, value);
  }

  /**
   * Delegado al Value Object Telefono del Dominio.
   */
  private parseTelefono(text: string): Telefono | undefined {
    try {
      return Telefono.crear(text);
    } catch (_e) {
      return undefined;
    }
  }

  /**
   * Delegado al Value Object Email del Dominio.
   */
  private parseEmail(text: string): Email | undefined {
    try {
      return Email.crear(text);
    } catch (_e) {
      return undefined;
    }
  }

  /**
   * Cierra la sesión y persiste el Lead, incluso si está incompleto.
   * Determina automáticamente qué tipo de Lead es en base a los datos recolectados.
   */
  async finalizeSession(sessionId: string) {
    const data = this.sessionData.get(sessionId);
    if (!data) return; // No hay datos para guardar

    const nombre = data["Nombre_y_Apellido"];
    const telefonoRaw = data["Telefono_WhatsApp"] || data["Telefono"] || data["Telefono_WhatsApp_Email"] || '';
    const emailRaw = data["Correo_Electronico"] || data["Email"] || data["Telefono_WhatsApp_Email"] || '';
    
    // Tratamos de extraer teléfono o email de los campos correspondientes
    const telefono = this.parseTelefono(telefonoRaw);
    const email = this.parseEmail(emailRaw);

    // Si tenemos Curso de Interés, es un LeadListaEspera
    if (data["Curso_Interes"]) {
      const lead: LeadListaEspera = {
        nombre: nombre,
        telefono: telefono,
        correoElectronico: email,
        cursoDeInteres: data["Curso_Interes"]
      };
      await this.leadRepository.saveListaEspera(sessionId, lead);
    } 
    // De lo contrario, si hay Consulta, es un LeadContacto
    else if (data["Consulta_Personalizada"]) {
      const lead: LeadContacto = {
        nombre: nombre,
        telefono: telefono,
        correoElectronico: email,
        mensaje: data["Consulta_Personalizada"]
      };
      await this.leadRepository.saveContacto(sessionId, lead);
    } 
    // Si no es ninguno específico pero tiene nombre/contacto, guardamos un Contacto genérico incompleto
    else if (nombre || telefono || email) {
      const lead: LeadContacto = {
        nombre: nombre,
        telefono: telefono,
        correoElectronico: email,
        mensaje: "Conversación cerrada antes de completar"
      };
      await this.leadRepository.saveContacto(sessionId, lead);
    }

    // Limpiar la memoria
    this.sessionData.delete(sessionId);
  }
}
