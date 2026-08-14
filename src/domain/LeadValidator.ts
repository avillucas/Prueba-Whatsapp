import { Telefono, Email } from "./Lead";

export class LeadValidator {
  /**
   * Servicio de Dominio para validar cualquier campo de un Lead.
   * Lanza o retorna mensajes de error dictados directamente por las reglas del negocio.
   */
  static validar(key: string, value: string): string | null {
    const trimmed = value.trim();

    try {
      if (key.includes("Telefono") || key === "Telefono_WhatsApp") {
        Telefono.crear(trimmed);
        return null;
      }

      if (key.includes("Correo") || key.includes("Email") || key === "Correo_Electronico") {
        Email.crear(trimmed);
        return null;
      }

      if (key === "Nombre_y_Apellido") {
        if (trimmed.length < 2 || /^\d+$/.test(trimmed)) {
          return "El nombre y apellido ingresado no es válido. Debe contener letras y al menos 2 caracteres.";
        }
        return null;
      }

      return null;
    } catch (error: any) {
      return error.message || "El valor ingresado no cumple con las reglas del negocio.";
    }
  }
}
