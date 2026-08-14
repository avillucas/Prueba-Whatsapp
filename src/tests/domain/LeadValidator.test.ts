import { LeadValidator } from "../../domain/LeadValidator";

describe("LeadValidator Domain Service", () => {
  it("Debería validar correctamente teléfonos", () => {
    expect(LeadValidator.validar("Telefono_WhatsApp", "+5491135204878")).toBeNull();
    expect(LeadValidator.validar("Telefono", "123")).toContain("debe contener al menos 6 dígitos");
  });

  it("Debería validar correctamente emails", () => {
    expect(LeadValidator.validar("Correo_Electronico", "usuario@email.com")).toBeNull();
    expect(LeadValidator.validar("Email", "invalido")).toContain("no tiene un formato válido");
  });

  it("Debería validar correctamente nombre y apellido", () => {
    expect(LeadValidator.validar("Nombre_y_Apellido", "Lucas Avila")).toBeNull();
    expect(LeadValidator.validar("Nombre_y_Apellido", "123")).toContain("no es válido");
    expect(LeadValidator.validar("Nombre_y_Apellido", "A")).toContain("no es válido");
  });

  it("Debería retornar null para otros campos sin reglas específicas", () => {
    expect(LeadValidator.validar("Consulta_Personalizada", "Hola")).toBeNull();
    expect(LeadValidator.validar("Curso_Interes", "Mecánica")).toBeNull();
  });
});
