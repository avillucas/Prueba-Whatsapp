import * as fs from 'fs';
import * as path from 'path';
import { ErrorHandler } from '../../infrastructure/logging/ErrorHandler';

describe("ErrorHandler Logging Service", () => {
  const testDir = path.join(__dirname, 'temp_log_test');

  beforeEach(() => {
    ErrorHandler.setLogDirectory(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("Debería registrar errores en errors.log", () => {
    ErrorHandler.handle("TestContext", new Error("Error de prueba"), { detail: 123 });

    const errorFilePath = ErrorHandler.getErrorLogFilePath();
    expect(fs.existsSync(errorFilePath)).toBe(true);

    const content = fs.readFileSync(errorFilePath, 'utf-8');
    expect(content).toContain("Error de prueba");
    expect(content).toContain('"detail":123');
  });

  it("Debería registrar mensajes de sistema en system.log", () => {
    ErrorHandler.logSystem("SystemContext", "Mensaje de información de sistema");

    const systemFilePath = ErrorHandler.getSystemLogFilePath();
    expect(fs.existsSync(systemFilePath)).toBe(true);

    const content = fs.readFileSync(systemFilePath, 'utf-8');
    expect(content).toContain("[SystemContext] INFO: Mensaje de información de sistema");
  });

  it("Debería retornar el adaptador actual vía getAdapter", () => {
    const adapter = ErrorHandler.getAdapter();
    expect(adapter).toBeDefined();
  });

  it("Debería retornar cadena vacía en rutas si el adaptador no es FileLoggerAdapter", () => {
    const mockAdapter = {
      handleError: jest.fn(),
      logSystem: jest.fn()
    };
    ErrorHandler.setAdapter(mockAdapter);

    expect(ErrorHandler.getErrorLogFilePath()).toBe('');
    expect(ErrorHandler.getSystemLogFilePath()).toBe('');
  });

  it("Debería re-instanciar FileLoggerAdapter al llamar setLogDirectory si el adaptador actual no es FileLoggerAdapter", () => {
    const mockAdapter = {
      handleError: jest.fn(),
      logSystem: jest.fn()
    };
    ErrorHandler.setAdapter(mockAdapter);

    ErrorHandler.setLogDirectory(testDir);
    expect(ErrorHandler.getAdapter().constructor.name).toBe('FileLoggerAdapter');
  });
});
