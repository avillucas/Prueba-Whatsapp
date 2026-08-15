import * as fs from 'fs';
import * as path from 'path';
import { FileLoggerAdapter } from '../../infrastructure/adapters/logging/FileLoggerAdapter';
import { GCPLoggerAdapter } from '../../infrastructure/adapters/logging/GCPLoggerAdapter';
import { LoggerFactory } from '../../infrastructure/adapters/logging/LoggerFactory';
import { ErrorHandler } from '../../infrastructure/logging/ErrorHandler';

describe("Logging Adapters Suite", () => {
  const testDir = path.join(__dirname, 'temp_logger_test');

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete process.env.LOG_ADAPTER;
    delete process.env.LOG_TYPE;
  });

  describe("FileLoggerAdapter", () => {
    it("debería escribir errores en errors.log", () => {
      const adapter = new FileLoggerAdapter(testDir);
      adapter.handleError("FileContext", new Error("Error en archivo local"), { id: 456 });

      const errorPath = adapter.getErrorLogFilePath();
      expect(fs.existsSync(errorPath)).toBe(true);

      const content = fs.readFileSync(errorPath, 'utf-8');
      expect(content).toContain("[FileContext] ERROR: Error en archivo local");
      expect(content).toContain('"id":456');
    });

    it("debería escribir eventos de sistema en system.log", () => {
      const adapter = new FileLoggerAdapter(testDir);
      adapter.logSystem("FileContext", "Evento de sistema registrado");

      const systemPath = adapter.getSystemLogFilePath();
      expect(fs.existsSync(systemPath)).toBe(true);

      const content = fs.readFileSync(systemPath, 'utf-8');
      expect(content).toContain("[FileContext] INFO: Evento de sistema registrado");
    });
  });

  describe("GCPLoggerAdapter", () => {
    it("debería emitir JSON estructurado a process.stderr en handleError", () => {
      const adapter = new GCPLoggerAdapter();
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      adapter.handleError("GCPContext", new Error("Error GCP Cloud"), { extra: "data" });

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.severity).toBe("ERROR");
      expect(parsed.context).toBe("GCPContext");
      expect(parsed.message).toContain("Error GCP Cloud");
      expect(parsed.extraData).toEqual({ extra: "data" });

      stderrSpy.mockRestore();
    });

    it("debería emitir JSON estructurado a process.stdout en logSystem", () => {
      const adapter = new GCPLoggerAdapter();
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      adapter.logSystem("GCPContext", "Inicio de servicio GCP", { version: "1.0.0" });

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.severity).toBe("INFO");
      expect(parsed.context).toBe("GCPContext");
      expect(parsed.message).toContain("Inicio de servicio GCP");
      expect(parsed.extraData).toEqual({ version: "1.0.0" });

      stdoutSpy.mockRestore();
    });
  });

  describe("LoggerFactory", () => {
    it("debería instanciar FileLoggerAdapter por defecto", () => {
      const adapter = LoggerFactory.create();
      expect(adapter).toBeInstanceOf(FileLoggerAdapter);
    });

    it("debería instanciar GCPLoggerAdapter si el tipo es 'gcp' o 'google'", () => {
      const gcpAdapter = LoggerFactory.create('gcp');
      expect(gcpAdapter).toBeInstanceOf(GCPLoggerAdapter);

      const googleAdapter = LoggerFactory.create('google');
      expect(googleAdapter).toBeInstanceOf(GCPLoggerAdapter);
    });

    it("debería instanciar GCPLoggerAdapter si la variable de entorno LOG_ADAPTER es 'gcp'", () => {
      process.env.LOG_ADAPTER = 'gcp';
      const adapter = LoggerFactory.create();
      expect(adapter).toBeInstanceOf(GCPLoggerAdapter);
    });
  });

  describe("ErrorHandler integración con LoggerFactory", () => {
    it("debería permitir cambiar dinámicamente el adaptador usado por ErrorHandler", () => {
      const gcpAdapter = new GCPLoggerAdapter();
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      ErrorHandler.setAdapter(gcpAdapter);
      ErrorHandler.logSystem("IntegrationContext", "Mensaje a través de ErrorHandler");

      expect(stdoutSpy).toHaveBeenCalled();
      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output).toContain("IntegrationContext");

      stdoutSpy.mockRestore();
    });
  });
});
