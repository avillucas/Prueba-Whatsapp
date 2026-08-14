import { loadConfig } from '../../config/config';

describe("Config Loader", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("Debería cargar la configuración predeterminada correctamente", () => {
    delete process.env.INTERFACE;
    delete process.env.FLOW_FILE;
    delete process.env.LEADS_STORAGE_TYPE;
    
    const config = loadConfig();
    expect(config.interface).toBeDefined();
    expect(config.flowFile).toBeDefined();
    expect(config.leadsStorage.type).toBe('csv');
  });

  it("Debería sobrescribir valores desde variables de entorno", () => {
    process.env.INTERFACE = 'baileys';
    process.env.FLOW_FILE = 'flow_test.json';
    process.env.LEADS_STORAGE_TYPE = 'csv';

    const config = loadConfig();
    expect(config.interface).toBe('baileys');
    expect(config.flowFile).toBe('flow_test.json');
    expect(config.leadsStorage.type).toBe('csv');
  });

  it("Debería validar credenciales requeridas cuando el tipo es google_sheets", () => {
    process.env.LEADS_STORAGE_TYPE = 'google_sheets';
    delete process.env.GOOGLE_SPREADSHEET_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    expect(() => loadConfig()).toThrow(/Google Sheets está activo/);
  });

  it("Debería permitir google_sheets si webhookUrl está presente", () => {
    process.env.LEADS_STORAGE_TYPE = 'google_sheets';
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/xyz/exec';

    const config = loadConfig();
    expect(config.leadsStorage.type).toBe('google_sheets');
    expect(config.leadsStorage.googleSheets?.webhookUrl).toBe('https://script.google.com/macros/s/xyz/exec');
  });
});
