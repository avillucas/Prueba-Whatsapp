import { SessionLeadManager } from "../../application/SessionLeadManager";
import { LeadRepository } from "../../domain/LeadRepository";
import { LeadContacto, LeadListaEspera } from "../../domain/Lead";

// Mock del repositorio para evitar escribir en disco durante los tests
class MockLeadRepository implements LeadRepository {
  public savedContactos: { sessionId: string, lead: LeadContacto }[] = [];
  public savedListasEspera: { sessionId: string, lead: LeadListaEspera }[] = [];

  async saveContacto(sessionId: string, lead: LeadContacto): Promise<void> {
    this.savedContactos.push({ sessionId, lead });
  }

  async saveListaEspera(sessionId: string, lead: LeadListaEspera): Promise<void> {
    this.savedListasEspera.push({ sessionId, lead });
  }
}

describe("SessionLeadManager - Generación de Leads", () => {
  let repository: MockLeadRepository;
  let manager: SessionLeadManager;

  beforeEach(() => {
    repository = new MockLeadRepository();
    manager = new SessionLeadManager(repository);
  });

  it("Debería detectar y crear un LeadListaEspera válido", async () => {
    const sessionId = "session_espera_1";
    
    // Simulamos las respuestas extraídas durante un flujo de inscripción a curso
    manager.addData(sessionId, "Nombre_y_Apellido", "Juan Perez");
    manager.addData(sessionId, "Telefono_WhatsApp_Email", "5491144556677"); // Teléfono formato Argentina
    manager.addData(sessionId, "Curso_Interes", "Mecánica");
    
    // Simulamos el cierre de sesión
    await manager.finalizeSession(sessionId);
    
    // Verificaciones
    expect(repository.savedListasEspera.length).toBe(1);
    expect(repository.savedContactos.length).toBe(0);
    
    const saved = repository.savedListasEspera[0].lead;
    expect(saved.nombre).toBe("Juan Perez");
    expect(saved.cursoDeInteres).toBe("Mecánica");
    
    // Verificamos que el teléfono haya sido correctamente parseado a un Value Object
    expect(saved.telefono).toBeDefined();
    expect(saved.telefono?.codigoArea).toBe("54");
    expect(saved.telefono?.numero).toBe("91144556677");
    expect(saved.telefono?.numeroCompleto).toBe("+5491144556677");
  });

  it("Debería detectar y crear un LeadContacto válido extrayendo un Email", async () => {
    const sessionId = "session_contacto_1";
    
    // Simulamos las respuestas extraídas durante un flujo de consulta general
    manager.addData(sessionId, "Nombre_y_Apellido", "Maria Gomez");
    manager.addData(sessionId, "Telefono_WhatsApp_Email", "maria.gomez@gmail.com"); 
    manager.addData(sessionId, "Consulta_Personalizada", "Quisiera saber los horarios.");
    
    await manager.finalizeSession(sessionId);
    
    expect(repository.savedContactos.length).toBe(1);
    expect(repository.savedListasEspera.length).toBe(0);
    
    const saved = repository.savedContactos[0].lead;
    expect(saved.nombre).toBe("Maria Gomez");
    expect(saved.mensaje).toBe("Quisiera saber los horarios.");
    
    // Verificamos que el parser haya detectado que es un Email y no un teléfono
    expect(saved.correoElectronico).toBeDefined();
    expect(saved.correoElectronico?.valor).toBe("maria.gomez@gmail.com");
    expect(saved.telefono).toBeUndefined();
  });

  it("Debería crear un LeadContacto incompleto si el usuario abandona la charla", async () => {
    const sessionId = "session_incompleta_1";
    
    // El usuario solo completó el primer paso y luego se fue ("salir")
    manager.addData(sessionId, "Nombre_y_Apellido", "Pedro Incompleto");
    
    await manager.finalizeSession(sessionId);
    
    expect(repository.savedContactos.length).toBe(1);
    
    const saved = repository.savedContactos[0].lead;
    expect(saved.nombre).toBe("Pedro Incompleto");
    expect(saved.mensaje).toBe("Conversación cerrada antes de completar");
    expect(saved.telefono).toBeUndefined();
    expect(saved.correoElectronico).toBeUndefined();
  });

  it("Debería soportar initSession, getSessionData y hasValidField", () => {
    const sessionId = "session_init_1";
    manager.initSession(sessionId, {
      Telefono_WhatsApp: "+5491135204878",
      Correo_Electronico: "invalido" // No debe guardarse por inválido
    });

    expect(manager.getSessionData(sessionId, "Telefono_WhatsApp")).toBe("+5491135204878");
    expect(manager.getSessionData(sessionId, "Correo_Electronico")).toBeUndefined();
    expect(manager.hasValidField(sessionId, "Telefono_WhatsApp")).toBe(true);
    expect(manager.hasValidField(sessionId, "Correo_Electronico")).toBe(false);
  });

  it("Debería delegar la validación a LeadValidator", () => {
    expect(manager.validateField("Correo_Electronico", "test@test.com")).toBeNull();
    expect(manager.validateField("Correo_Electronico", "invalido")).not.toBeNull();
  });

  it("No debería guardar nada al finalizar si la sesión no tiene datos", async () => {
    await manager.finalizeSession("sesion_inexistente");
    expect(repository.savedContactos.length).toBe(0);
    expect(repository.savedListasEspera.length).toBe(0);
  });
});
