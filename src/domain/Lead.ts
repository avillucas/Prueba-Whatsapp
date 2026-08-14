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
}

export class Email {
  constructor(public readonly valor: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(valor)) {
      throw new Error("El formato del correo electrónico no es válido.");
    }
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
  cursoDeInteres?: string;
}

export type Lead = LeadContacto | LeadListaEspera;
