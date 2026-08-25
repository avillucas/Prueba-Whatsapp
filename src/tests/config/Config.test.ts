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
    expect(config.sessionConfig?.defaultFlowId).toBeDefined();
    expect(config.leadsStorage.type).toBe('csv');
  });

  it("Debería sobrescribir valores desde variables de entorno", () => {
    process.env.INTERFACE = 'baileys';
    process.env.FLOW_FILE = 'flow_test.json';
    process.env.LEADS_STORAGE_TYPE = 'csv';

    const config = loadConfig();
    expect(config.interface).toBe('baileys');
    expect(config.sessionConfig?.defaultFlowId).toBe('flow_test');
    expect(config.leadsStorage.type).toBe('csv');
  });

  it("Debería validar credenciales requeridas cuando el tipo es google_sheets", () => {
    process.env.LEADS_STORAGE_TYPE = 'google_sheets';
    delete process.env.GOOGLE_SPREADSHEET_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    expect(() => loadConfig()).toThrow(/Google Sheets está activo/);
  });

  it("Debería procesar variables de autenticación y logging de entorno", () => {
    process.env.AUTH_STORAGE_TYPE = 'google';
    process.env.GCS_BUCKET_NAME = 'my-bucket';
    process.env.AUTH_DIR = './custom_auth';
    process.env.LOG_ADAPTER = 'gcp';
    process.env.LOG_DIR = './custom_logs';

    const config = loadConfig();
    expect(config.authStorage?.type).toBe('google');
    expect(config.authStorage?.bucketName).toBe('my-bucket');
    expect(config.authStorage?.authDir).toBe('./custom_auth');
    expect(config.loggingStorage?.type).toBe('gcp');
    expect(config.loggingStorage?.logDir).toBe('./custom_logs');
  });

  it("Debería validar credenciales Service Account de Google Sheets si están completas", () => {
    process.env.LEADS_STORAGE_TYPE = 'google_sheets';
    process.env.GOOGLE_SPREADSHEET_ID = 'sheet_id_123';
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'service@account.com';
    process.env.GOOGLE_PRIVATE_KEY = 'private_key_xyz';
    process.env.GOOGLE_SHEETS_TAB_CONTACTOS = 'MisContactos';
    process.env.GOOGLE_SHEETS_TAB_LISTA_ESPERA = 'MiLista';

    const config = loadConfig();
    expect(config.leadsStorage.googleSheets?.spreadsheetId).toBe('sheet_id_123');
    expect(config.leadsStorage.googleSheets?.clientEmail).toBe('service@account.com');
    expect(config.leadsStorage.googleSheets?.privateKey).toBe('private_key_xyz');
    expect(config.leadsStorage.googleSheets?.sheetContactoName).toBe('MisContactos');
    expect(config.leadsStorage.googleSheets?.sheetListaEsperaName).toBe('MiLista');
  });

  it("Debería procesar variables de entorno para la sesión y el servidor administrativo", () => {
    process.env.DEFAULT_FLOW_ID = 'flow_custom_env';
    process.env.SESSION_TIMEOUT_MINUTES = '30';
    process.env.ADMIN_PORT = '4000';
    process.env.ADMIN_PASSWORD = 'envpassword';
    process.env.REDIS_HOST = 'redis.local';
    process.env.REDIS_PORT = '6380';

    const config = loadConfig();
    expect(config.sessionConfig?.defaultFlowId).toBe('flow_custom_env');
    expect(config.sessionConfig?.timeoutMinutes).toBe(30);
    expect(config.adminWeb?.port).toBe(4000);
    expect(config.adminWeb?.password).toBe('envpassword');
    expect(config.authStorage?.redis?.host).toBe('redis.local');
    expect(config.authStorage?.redis?.port).toBe(6380);
  });
});
