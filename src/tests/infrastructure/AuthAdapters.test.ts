import * as fs from 'fs';
import * as path from 'path';
import { FileAuthAdapter } from '../../infrastructure/adapters/auth/FileAuthAdapter';
import { GoogleAuthAdapter } from '../../infrastructure/adapters/auth/GoogleAuthAdapter';
import { AuthStorageFactory } from '../../infrastructure/adapters/auth/AuthStorageFactory';

const mockDownload = jest.fn().mockResolvedValue(undefined);
const mockUpload = jest.fn().mockResolvedValue(undefined);
const mockGetFiles = jest.fn().mockResolvedValue([
  [
    { name: 'auth_info/creds.json', download: mockDownload },
    { name: 'auth_info/session-1.json', download: mockDownload },
    { name: 'auth_info/', download: mockDownload } // Prefijo vacío para probar filtro
  ]
]);

const mockBucket = {
  getFiles: mockGetFiles,
  upload: mockUpload
};

jest.mock('@google-cloud/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => ({
      bucket: jest.fn(() => mockBucket)
    }))
  };
}, { virtual: true });

describe('Auth Storage Adapters Suite', () => {
  const testAuthDir = path.resolve(__dirname, 'temp_test_auth_info');

  afterEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(testAuthDir)) {
      fs.rmSync(testAuthDir, { recursive: true, force: true });
    }
  });

  describe('FileAuthAdapter', () => {
    it('debería crear el directorio de autenticación si no existe', async () => {
      const adapter = new FileAuthAdapter(testAuthDir);
      expect(fs.existsSync(testAuthDir)).toBe(false);

      await adapter.beforeAuth();

      expect(fs.existsSync(testAuthDir)).toBe(true);
      expect(adapter.getAuthDir()).toBe(testAuthDir);
    });

    it('debería usar directorio existente si ya fue creado', async () => {
      fs.mkdirSync(testAuthDir, { recursive: true });
      const adapter = new FileAuthAdapter(testAuthDir);
      await adapter.beforeAuth();
      expect(fs.existsSync(testAuthDir)).toBe(true);
    });

    it('debería ejecutar afterSaveCreds sin lanzar errores', async () => {
      const adapter = new FileAuthAdapter(testAuthDir);
      await adapter.beforeAuth();
      await expect(adapter.afterSaveCreds()).resolves.not.toThrow();
    });
  });

  describe('GoogleAuthAdapter', () => {
    it('debería descargar archivos desde GCS antes de autenticar', async () => {
      const adapter = new GoogleAuthAdapter({
        bucketName: 'test-bucket',
        localDir: testAuthDir,
        prefix: 'auth_info',
        clientEmail: 'service@test.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----'
      });

      await adapter.beforeAuth();

      expect(mockGetFiles).toHaveBeenCalledWith({ prefix: 'auth_info/' });
      expect(mockDownload).toHaveBeenCalled();
      expect(adapter.getAuthDir()).toBe(testAuthDir);
    });

    it('debería manejar el caso cuando GCS no tiene archivos previos', async () => {
      mockGetFiles.mockResolvedValueOnce([[]]);
      const adapter = new GoogleAuthAdapter({
        bucketName: 'test-bucket',
        localDir: testAuthDir
      });

      await adapter.beforeAuth();
      expect(mockGetFiles).toHaveBeenCalled();
    });

    it('debería capturar errores al descargar de GCS sin lanzar excepción', async () => {
      mockGetFiles.mockRejectedValueOnce(new Error('GCS Error Network'));
      const adapter = new GoogleAuthAdapter({
        bucketName: 'test-bucket',
        localDir: testAuthDir
      });

      await expect(adapter.beforeAuth()).resolves.not.toThrow();
    });

    it('debería subir los archivos locales a GCS después de guardar credenciales', async () => {
      const adapter = new GoogleAuthAdapter({
        bucketName: 'test-bucket',
        localDir: testAuthDir,
        prefix: 'auth_info'
      });

      fs.mkdirSync(testAuthDir, { recursive: true });
      fs.writeFileSync(path.join(testAuthDir, 'creds.json'), '{"me":"test"}');

      await adapter.afterSaveCreds();

      expect(mockUpload).toHaveBeenCalledWith(
        path.join(testAuthDir, 'creds.json'),
        expect.objectContaining({ destination: 'auth_info/creds.json' })
      );
    });

    it('debería manejar errores al subir a GCS', async () => {
      mockUpload.mockRejectedValueOnce(new Error('Upload error'));
      const adapter = new GoogleAuthAdapter({
        bucketName: 'test-bucket',
        localDir: testAuthDir
      });

      fs.mkdirSync(testAuthDir, { recursive: true });
      fs.writeFileSync(path.join(testAuthDir, 'creds.json'), '{"me":"test"}');

      await expect(adapter.afterSaveCreds()).resolves.not.toThrow();
    });
  });

  describe('AuthStorageFactory', () => {
    it('debería retornar FileAuthAdapter por defecto si no se especifica tipo', () => {
      const adapter = AuthStorageFactory.create();
      expect(adapter).toBeInstanceOf(FileAuthAdapter);
    });

    it("debería retornar FileAuthAdapter cuando tipo es 'file'", () => {
      const adapter = AuthStorageFactory.create('file');
      expect(adapter).toBeInstanceOf(FileAuthAdapter);
    });

    it("debería retornar GoogleAuthAdapter cuando tipo es 'google' o 'gcs'", () => {
      const adapterGoogle = AuthStorageFactory.create('google');
      expect(adapterGoogle).toBeInstanceOf(GoogleAuthAdapter);

      const adapterGcs = AuthStorageFactory.create('gcs');
      expect(adapterGcs).toBeInstanceOf(GoogleAuthAdapter);
    });

    it('debería respetar las variables de entorno para seleccionar el adaptador', () => {
      const originalEnv = process.env.AUTH_STORAGE_TYPE;
      process.env.AUTH_STORAGE_TYPE = 'google';

      const adapter = AuthStorageFactory.create();
      expect(adapter).toBeInstanceOf(GoogleAuthAdapter);

      process.env.AUTH_STORAGE_TYPE = originalEnv;
    });
  });
});
