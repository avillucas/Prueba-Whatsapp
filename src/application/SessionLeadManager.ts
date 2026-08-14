import { Email, Telefono, LeadContacto, LeadListaEspera } from "../domain/Lead";
import { LeadRepository } from "../domain/LeadRepository";

export class SessionLeadManager {
  // Guardamos un diccionario con los datos temporales extraídos de cada sesión
  private sessionData: Map<string, Record<string, string>> = new Map();

  constructor(private leadRepository: LeadRepository) {}

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
   * Sanitiza e intenta parsear un teléfono a partir de texto libre.
   */
  private parseTelefono(text: string): Telefono | undefined {
    const numbers = text.replace(/\D/g, '');
    if (numbers.length >= 6) {
      try {
        // Heurística simple: primeros 2-3 dígitos como código de área
        // Si empieza con 54 (código país Argentina):
        if (numbers.startsWith('54')) {
          return new Telefono('54', numbers.slice(2));
        }
        // Si empieza con 11 (CABA/GBA):
        if (numbers.startsWith('11')) {
          return new Telefono('11', numbers.slice(2));
        }
        // Fallback genérico: 3 dígitos de área
        return new Telefono(numbers.slice(0, 3), numbers.slice(3));
      } catch (e) {
        return undefined; // Si la validación del VO falla, retornamos undefined
      }
    }
    return undefined;
  }

  /**
   * Sanitiza e intenta parsear un correo electrónico a partir de texto libre.
   */
  private parseEmail(text: string): Email | undefined {
    const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (match) {
      try {
        return new Email(match[1]);
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Cierra la sesión y persiste el Lead, incluso si está incompleto.
   * Determina automáticamente qué tipo de Lead es en base a los datos recolectados.
   */
  async finalizeSession(sessionId: string) {
    const data = this.sessionData.get(sessionId);
    if (!data) return; // No hay datos para guardar

    const nombre = data["Nombre_y_Apellido"];
    const contactoRaw = data["Telefono_WhatsApp_Email"] || '';
    
    // Tratamos de extraer teléfono o email del campo unificado
    const telefono = this.parseTelefono(contactoRaw);
    const email = this.parseEmail(contactoRaw);

    // Si tenemos Curso de Interés, es un LeadListaEspera
    if (data["Curso_Interes"]) {
      const lead: LeadListaEspera = {
        nombre: nombre,
        telefono: telefono,
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
