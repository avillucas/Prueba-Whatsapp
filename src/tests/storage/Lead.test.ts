import { Telefono, Email, LeadContacto, LeadListaEspera } from "../../domain/Lead";

describe("Domain Entities - Value Objects", () => {
  describe("Telefono", () => {
    it("Debería crear un teléfono válido", () => {
      const tel = new Telefono("54", "9112345678");
      expect(tel.codigoArea).toBe("54");
      expect(tel.numero).toBe("9112345678");
      expect(tel.numeroCompleto).toBe("+549112345678");
    });

    it("Debería lanzar error si el código de área contiene letras", () => {
      expect(() => {
        new Telefono("54A", "9112345678");
      }).toThrow("El código de área debe contener solo números.");
    });

    it("Debería lanzar error si el número contiene letras", () => {
      expect(() => {
        new Telefono("54", "911234A5678");
      }).toThrow("El número de teléfono debe contener solo números.");
    });

    it("Debería lanzar error si el código de área es muy largo", () => {
      expect(() => {
        new Telefono("12345", "9112345678");
      }).toThrow("La longitud del código de área no es válida.");
    });

    it("Debería lanzar error si el número es muy corto o largo", () => {
      expect(() => {
        new Telefono("54", "123");
      }).toThrow("La longitud del número de teléfono no es válida.");

      expect(() => {
        new Telefono("54", "123456789012345");
      }).toThrow("La longitud del número de teléfono no es válida.");
    });
  });

  describe("Email", () => {
    it("Debería crear un email válido", () => {
      const email = new Email("usuario@ejemplo.com");
      expect(email.valor).toBe("usuario@ejemplo.com");
    });

    it("Debería lanzar error si falta el @", () => {
      expect(() => {
        new Email("usuarioejemplo.com");
      }).toThrow(/El formato del correo electrónico no es válido/);
    });

    it("Debería lanzar error si falta el dominio", () => {
      expect(() => {
        new Email("usuario@");
      }).toThrow(/El formato del correo electrónico no es válido/);
    });

    it("Debería lanzar error si tiene espacios", () => {
      expect(() => {
        new Email("usuario @ejemplo.com");
      }).toThrow(/El formato del correo electrónico no es válido/);
    });

    it("Debería crear Email con Email.crear o lanzar error", () => {
      const e = Email.crear("test@email.com");
      expect(e.valor).toBe("test@email.com");
      expect(() => Email.crear("invalido")).toThrow(/El correo electrónico no tiene un formato válido/);
    });
  });

  describe("Telefono.crear", () => {
    it("Debería crear teléfonos válidos con código de país 54 o 11", () => {
      const t1 = Telefono.crear("+54 9 11 3520-4878");
      expect(t1.codigoArea).toBe("54");
      expect(t1.numero).toBe("91135204878");

      const t2 = Telefono.crear("11 3520-4878");
      expect(t2.codigoArea).toBe("11");
      expect(t2.numero).toBe("35204878");

      const t3 = Telefono.crear("221 456 7890");
      expect(t3.codigoArea).toBe("221");
      expect(t3.numero).toBe("4567890");
    });

    it("Debería lanzar error si tiene menos de 6 dígitos", () => {
      expect(() => Telefono.crear("123")).toThrow("El número de teléfono debe contener al menos 6 dígitos numéricos.");
    });
  });

  describe("LeadContacto y LeadListaEspera", () => {
    it("Debería poder instanciar un LeadContacto completo", () => {
      const lead: import("../../domain/Lead").LeadContacto = {
        nombre: "Lucas",
        telefono: new Telefono("54", "91122334455"),
        correoElectronico: new Email("lucas@ejemplo.com"),
        mensaje: "Consulta sobre curso"
      };

      expect(lead.nombre).toBe("Lucas");
      expect(lead.telefono?.numeroCompleto).toBe("+5491122334455");
      expect(lead.correoElectronico?.valor).toBe("lucas@ejemplo.com");
      expect(lead.mensaje).toBe("Consulta sobre curso");
    });

    it("Debería poder instanciar un LeadContacto parcial (abandonado)", () => {
      const lead: import("../../domain/Lead").LeadContacto = {
        nombre: "Lucas Parcial",
        mensaje: "Conversación cerrada antes de completar"
      };

      expect(lead.nombre).toBe("Lucas Parcial");
      expect(lead.telefono).toBeUndefined();
      expect(lead.correoElectronico).toBeUndefined();
    });

    it("Debería poder instanciar un LeadListaEspera completo", () => {
      const lead: import("../../domain/Lead").LeadListaEspera = {
        nombre: "Ana",
        telefono: new Telefono("54", "91199887766"),
        cursoDeInteres: "Electricidad del Automóvil"
      };

      expect(lead.nombre).toBe("Ana");
      expect(lead.telefono?.numeroCompleto).toBe("+5491199887766");
      expect(lead.cursoDeInteres).toBe("Electricidad del Automóvil");
    });
  });
});
