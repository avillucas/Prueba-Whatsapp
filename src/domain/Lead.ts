export class Telefono {
  constructor(public readonly codigoArea: string, public readonly numero: string) {
    if (!/^\d+$/.test(codigoArea)) {
      throw new Error("El código de área debe contener solo números.");
    }
    if (!/^\d+$/.test(numero)) {
      throw new Error("El número de teléfono debe contener solo números.");
    }
    if (codigoArea.length < 1 || codigoArea.length > 4) {
      throw new Error("La longitud del código de área no es válida.");
    }
    if (numero.length < 4 || numero.length > 14) {
      throw new Error("La longitud del número de teléfono no es válida.");
    }
  }

  get numeroCompleto(): string {
    return `+${this.codigoArea}${this.numero}`;
  }

  static crear(text: string): Telefono {
    const numbers = text.replace(/\D/g, '');
    if (numbers.length < 6) {
      throw new Error("El número de teléfono debe contener al menos 6 dígitos numéricos.");
    }
    if (numbers.startsWith('54')) {
      return new Telefono('54', numbers.slice(2));
    }
    if (numbers.startsWith('11')) {
      return new Telefono('11', numbers.slice(2));
    }
    return new Telefono(numbers.slice(0, 3), numbers.slice(3));
  }
}

export class Email {
  constructor(public readonly valor: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(valor)) {
      throw new Error("El formato del correo electrónico no es válido (ejemplo: usuario@email.com).");
    }
  }

  static crear(text: string): Email {
    const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error("El correo electrónico no tiene un formato válido (ejemplo: usuario@email.com).");
    }
    return new Email(match[1]);
  }
}

export interface LeadContacto {
  nombre?: string;
  telefono?: Telefono;
  correoElectronico?: Email;
  mensaje?: string;
}

export interface LeadListaEspera {
  nombre?: string;
  telefono?: Telefono;
  correoElectronico?: Email;
  cursoDeInteres?: string;
}

export type Lead = LeadContacto | LeadListaEspera;
