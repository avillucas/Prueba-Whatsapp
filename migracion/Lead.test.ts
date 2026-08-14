import { Email, Telefono } from "./Lead";

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
      }).toThrow("El formato del correo electrónico no es válido.");
    });

    it("Debería lanzar error si falta el dominio", () => {
      expect(() => {
        new Email("usuario@");
      }).toThrow("El formato del correo electrónico no es válido.");
    });

    it("Debería lanzar error si tiene espacios", () => {
      expect(() => {
        new Email("usuario @ejemplo.com");
      }).toThrow("El formato del correo electrónico no es válido.");
    });
  });

  describe("LeadContacto y LeadListaEspera", () => {
    it("Debería poder instanciar un LeadContacto completo", () => {
      const lead: import("./Lead").LeadContacto = {
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
      const lead: import("./Lead").LeadContacto = {
        nombre: "Lucas Parcial",
        mensaje: "Conversación cerrada antes de completar"
      };

      expect(lead.nombre).toBe("Lucas Parcial");
      expect(lead.telefono).toBeUndefined();
      expect(lead.correoElectronico).toBeUndefined();
    });

    it("Debería poder instanciar un LeadListaEspera completo", () => {
      const lead: import("./Lead").LeadListaEspera = {
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
