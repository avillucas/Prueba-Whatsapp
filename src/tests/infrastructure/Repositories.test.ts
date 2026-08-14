import * as fs from 'fs';
import * as path from 'path';
import { CsvLeadRepository } from '../../infrastructure/repositories/CsvLeadRepository';
import { GoogleSheetsLeadRepository } from '../../infrastructure/repositories/GoogleSheetsLeadRepository';
import { CompositeLeadRepository } from '../../infrastructure/repositories/CompositeLeadRepository';
import { LeadRepositoryFactory, createLeadRepository } from '../../infrastructure/repositories/LeadRepositoryFactory';
import { GoogleSheetsAdapter } from '../../infrastructure/adapters/GoogleSheetsAdapter';
import { Telefono, Email } from '../../domain/Lead';

describe("Infrastructure Repositories & Adapters", () => {
  const testDataDir = path.join(__dirname, 'temp_test_data');

  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe("CsvLeadRepository", () => {
    it("Debería crear el directorio y archivos CSV iniciales", () => {
      const repo = new CsvLeadRepository(testDataDir);
      expect(fs.existsSync(path.join(testDataDir, 'contactos.csv'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'lista_espera.csv'))).toBe(true);
    });

    it("Debería guardar un contacto y una lista de espera escapando campos", async () => {
      const repo = new CsvLeadRepository(testDataDir);
      await repo.saveContacto("s1", {
        nombre: "Lucas \"Pro\"",
        telefono: new Telefono("54", "911223344"),
        correoElectronico: new Email("test@domain.com"),
        mensaje: "Mensaje con, comas\ny saltos"
      });

      await repo.saveListaEspera("s2", {
        nombre: "Ana",
        telefono: new Telefono("11", "33445566"),
        correoElectronico: new Email("ana@domain.com"),
        cursoDeInteres: "CAD"
      });

      const contactosContent = fs.readFileSync(path.join(testDataDir, 'contactos.csv'), 'utf-8');
      expect(contactosContent).toContain("s1");
      expect(contactosContent).toContain("test@domain.com");

      const listaContent = fs.readFileSync(path.join(testDataDir, 'lista_espera.csv'), 'utf-8');
      expect(listaContent).toContain("s2");
      expect(listaContent).toContain("CAD");
    });
  });

  describe("GoogleSheetsAdapter & GoogleSheetsLeadRepository", () => {
    it("Debería hacer fallback a Dry Run si no hay credenciales ni webhook", async () => {
      const gsRepo = new GoogleSheetsLeadRepository({});
      await expect(gsRepo.saveContacto("s1", { nombre: "Test" })).resolves.toBeUndefined();
      await expect(gsRepo.saveListaEspera("s2", { nombre: "Test" })).resolves.toBeUndefined();
    });

    it("Debería lanzar error al intentar leer sin credenciales", async () => {
      const gsRepo = new GoogleSheetsLeadRepository({});
      await expect(gsRepo.getContactos()).rejects.toThrow(/requiere spreadsheetId/);
      await expect(gsRepo.getListaEspera()).rejects.toThrow(/requiere spreadsheetId/);
    });

    it("Debería delegar llamadas via Webhook si webhookUrl está presente", async () => {
      const mockAdapter = {
        appendRow: jest.fn().mockResolvedValue(true),
        readRows: jest.fn().mockResolvedValue([["col1", "col2"]])
      } as unknown as GoogleSheetsAdapter;

      const gsRepo = new GoogleSheetsLeadRepository({ sheetContactoName: "C", sheetListaEsperaName: "L" }, mockAdapter);
      
      await gsRepo.saveContacto("s1", { nombre: "Test Contacto" });
      expect(mockAdapter.appendRow).toHaveBeenCalledWith("C", expect.any(Array));

      await gsRepo.saveListaEspera("s2", { nombre: "Test Lista" });
      expect(mockAdapter.appendRow).toHaveBeenCalledWith("L", expect.any(Array));

      const contactos = await gsRepo.getContactos();
      expect(contactos).toEqual([["col1", "col2"]]);

      const lista = await gsRepo.getListaEspera();
      expect(lista).toEqual([["col1", "col2"]]);
    });
  });

  describe("CompositeLeadRepository", () => {
    it("Debería propagar llamados a múltiples repositorios y capturar errores de repos individuales", async () => {
      const repoSuccess = {
        saveContacto: jest.fn().mockResolvedValue(undefined),
        saveListaEspera: jest.fn().mockResolvedValue(undefined)
      };
      const repoFailing = {
        saveContacto: jest.fn().mockRejectedValue(new Error("Error repo 2")),
        saveListaEspera: jest.fn().mockRejectedValue(new Error("Error repo 2"))
      };

      const composite = new CompositeLeadRepository([repoSuccess as any, repoFailing as any]);

      await composite.saveContacto("s1", { nombre: "Test" });
      expect(repoSuccess.saveContacto).toHaveBeenCalled();

      await composite.saveListaEspera("s2", { nombre: "Test" });
      expect(repoSuccess.saveListaEspera).toHaveBeenCalled();
    });
  });

  describe("LeadRepositoryFactory", () => {
    it("Debería instanciar CsvLeadRepository por defecto", () => {
      const repo = LeadRepositoryFactory.create('csv');
      expect(repo).toBeInstanceOf(CsvLeadRepository);
    });

    it("Debería instanciar GoogleSheetsLeadRepository", () => {
      const repo = LeadRepositoryFactory.create('google_sheets');
      expect(repo).toBeInstanceOf(GoogleSheetsLeadRepository);
    });

    it("Debería instanciar CompositeLeadRepository", () => {
      const repo = createLeadRepository('composite');
      expect(repo).toBeInstanceOf(CompositeLeadRepository);
    });
  });
});
