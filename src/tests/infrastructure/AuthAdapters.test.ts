import * as fs from 'fs';
import * as path from 'path';
import { RedisAuthAdapter } from '../../infrastructure/adapters/auth/RedisAuthAdapter';
import { FirestoreAuthAdapter } from '../../infrastructure/adapters/auth/FirestoreAuthAdapter';
import { AuthStorageFactory } from '../../infrastructure/adapters/auth/AuthStorageFactory';

// Mocks de ioredis
const mockHgetall = jest.fn().mockResolvedValue({});
const mockHset = jest.fn().mockResolvedValue(1);
const mockHdel = jest.fn().mockResolvedValue(1);
const mockPipelineExec = jest.fn().mockResolvedValue([]);
const mockPipeline = jest.fn().mockImplementation(() => ({
  hset: mockHset,
  hdel: mockHdel,
  exec: mockPipelineExec
}));
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockQuit = jest.fn().mockResolvedValue(undefined);

const mockOn = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    status: 'wait',
    connect: mockConnect,
    hgetall: mockHgetall,
    pipeline: mockPipeline,
    quit: mockQuit,
    on: mockOn
  }));
});

// Mocks de @google-cloud/firestore
const mockDocGet = jest.fn().mockResolvedValue({
  data: () => ({ content: '{"me":"test"}' })
});
const mockBatchSet = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

const mockCollectionGet = jest.fn().mockResolvedValue({
  empty: false,
  docs: [
    { id: 'creds.json', data: () => ({ content: '{"me":"test"}' }), ref: 'docRef1' }
  ]
});

const mockCollection = jest.fn().mockImplementation(() => ({
  get: mockCollectionGet,
  doc: jest.fn(() => ({ get: mockDocGet }))
}));

const mockBatch = jest.fn().mockImplementation(() => ({
  set: mockBatchSet,
  delete: mockBatchDelete,
  commit: mockBatchCommit
}));

jest.mock('@google-cloud/firestore', () => {
  return {
    Firestore: jest.fn().mockImplementation(() => ({
      collection: mockCollection,
      batch: mockBatch
    }))
  };
});

describe('Auth Storage Adapters Suite', () => {
  const testAuthDir = path.resolve(__dirname, 'temp_test_auth_info');

  afterEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(testAuthDir)) {
      fs.rmSync(testAuthDir, { recursive: true, force: true });
    }
  });

  describe('RedisAuthAdapter', () => {
    it('debería descargar archivos desde Redis antes de autenticar', async () => {
      mockHgetall.mockResolvedValueOnce({
        'creds.json': '{"me":"test"}'
      });

      const adapter = new RedisAuthAdapter({
        host: 'localhost',
        port: 6379,
        localDir: testAuthDir
      });

      await adapter.beforeAuth();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockHgetall).toHaveBeenCalled();
      expect(fs.existsSync(path.join(testAuthDir, 'creds.json'))).toBe(true);
      expect(adapter.getAuthDir()).toBe(testAuthDir);
    });

    it('debería manejar el caso cuando Redis no tiene credenciales', async () => {
      mockHgetall.mockResolvedValueOnce({});
      const adapter = new RedisAuthAdapter({ localDir: testAuthDir });

      await adapter.beforeAuth();
      expect(mockHgetall).toHaveBeenCalled();
    });

    it('debería sincronizar archivos locales con Redis en afterSaveCreds', async () => {
      const adapter = new RedisAuthAdapter({ localDir: testAuthDir });
      fs.mkdirSync(testAuthDir, { recursive: true });
      fs.writeFileSync(path.join(testAuthDir, 'creds.json'), '{"me":"test"}');

      await adapter.afterSaveCreds();

      expect(mockPipeline).toHaveBeenCalled();
      expect(mockHset).toHaveBeenCalledWith('whatsapp_auth', 'creds.json', '{"me":"test"}');
      expect(mockPipelineExec).toHaveBeenCalled();
    });
  });

  describe('FirestoreAuthAdapter', () => {
    it('debería descargar archivos desde Firestore antes de autenticar', async () => {
      const adapter = new FirestoreAuthAdapter({
        collectionName: 'whatsapp_auth',
        localDir: testAuthDir
      });

      await adapter.beforeAuth();

      expect(mockCollectionGet).toHaveBeenCalled();
      expect(fs.existsSync(path.join(testAuthDir, 'creds.json'))).toBe(true);
      expect(adapter.getAuthDir()).toBe(testAuthDir);
    });

    it('debería guardar credenciales en Firestore en afterSaveCreds', async () => {
      const adapter = new FirestoreAuthAdapter({
        collectionName: 'whatsapp_auth',
        localDir: testAuthDir
      });

      fs.mkdirSync(testAuthDir, { recursive: true });
      fs.writeFileSync(path.join(testAuthDir, 'creds.json'), '{"me":"test"}');

      await adapter.afterSaveCreds();

      expect(mockBatch).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
    });
  });

  describe('AuthStorageFactory', () => {
    it('debería retornar RedisAuthAdapter por defecto si no se especifica tipo', () => {
      const adapter = AuthStorageFactory.create();
      expect(adapter).toBeInstanceOf(RedisAuthAdapter);
    });

    it("debería retornar RedisAuthAdapter cuando el tipo es 'redis'", () => {
      const adapter = AuthStorageFactory.create('redis');
      expect(adapter).toBeInstanceOf(RedisAuthAdapter);
    });

    it("debería retornar FirestoreAuthAdapter cuando el tipo es 'firestore', 'firebase', 'firebase_firestore' o 'gcf'", () => {
      const adapterFirestore = AuthStorageFactory.create('firestore');
      expect(adapterFirestore).toBeInstanceOf(FirestoreAuthAdapter);

      const adapterFirebase = AuthStorageFactory.create('firebase');
      expect(adapterFirebase).toBeInstanceOf(FirestoreAuthAdapter);

      const adapterFirebaseFirestore = AuthStorageFactory.create('firebase_firestore');
      expect(adapterFirebaseFirestore).toBeInstanceOf(FirestoreAuthAdapter);

      const adapterGcf = AuthStorageFactory.create('gcf');
      expect(adapterGcf).toBeInstanceOf(FirestoreAuthAdapter);
    });

    it('debería respetar las variables de entorno para seleccionar el adaptador', () => {
      const originalEnv = process.env.AUTH_STORAGE_TYPE;
      process.env.AUTH_STORAGE_TYPE = 'firestore';

      const adapter = AuthStorageFactory.create();
      expect(adapter).toBeInstanceOf(FirestoreAuthAdapter);

      process.env.AUTH_STORAGE_TYPE = originalEnv;
    });
  });
});
