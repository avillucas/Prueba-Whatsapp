import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { AuthStorageAdapter } from '../../../domain/AuthStorageAdapter';
import { ErrorHandler } from '../../logging/ErrorHandler';

export interface FirestoreAuthAdapterOptions {
  collectionName?: string;
  projectId?: string;
  databaseId?: string;
  clientEmail?: string;
  privateKey?: string;
  localDir?: string;
}

export class FirestoreAuthAdapter implements AuthStorageAdapter {
  private firestore: Firestore;
  private collectionName: string;
  private localDir: string;

  constructor(options: FirestoreAuthAdapterOptions = {}) {
    this.collectionName = options.collectionName || process.env.FIRESTORE_COLLECTION_NAME || 'whatsapp_auth';
    this.localDir = options.localDir || process.env.AUTH_DIR || './auth_info';

    const firestoreOptions: any = {};
    const projectId = options.projectId || process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId) {
      firestoreOptions.projectId = projectId;
    }

    const databaseId = options.databaseId || process.env.FIRESTORE_DATABASE_ID || process.env.DATABASE;
    if (databaseId) {
      firestoreOptions.databaseId = databaseId;
    }

    const clientEmail = options.clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = options.privateKey || process.env.GOOGLE_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      firestoreOptions.credentials = {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n')
      };
    }

    this.firestore = new Firestore(firestoreOptions);
  }

  async beforeAuth(): Promise<void> {
    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }

    try {
      ErrorHandler.logSystem('FirestoreAuthAdapter', `Consultando credenciales en Firestore (Colección: '${this.collectionName}')...`);
      const collectionRef = this.firestore.collection(this.collectionName);
      const snapshot = await collectionRef.get();

      // Limpiamos los archivos del directorio temporal previo para asegurar sincronización exacta
      const existingLocalFiles = fs.readdirSync(this.localDir);
      for (const file of existingLocalFiles) {
        const fullPath = path.join(this.localDir, file);
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
        }
      }

      if (snapshot.empty) {
        ErrorHandler.logSystem('FirestoreAuthAdapter', `No se encontraron credenciales en Firestore (Colección: '${this.collectionName}'). Se iniciará sesión limpia.`);
        return;
      }

      let count = 0;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data && typeof data.content === 'string') {
          // Revertir posibles barras de escape en el id del documento si se reemplazaron
          const fileName = doc.id.replace(/___/g, '/');
          const filePath = path.join(this.localDir, fileName);
          
          // Crear subdirectorios si el nombre incluye rutas
          const parentDir = path.dirname(filePath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          fs.writeFileSync(filePath, data.content, 'utf-8');
          count++;
        }
      }

      ErrorHandler.logSystem('FirestoreAuthAdapter', `Sesión descargada exitosamente desde Firestore (${count} archivos cargados en '${this.localDir}').`);
    } catch (error: any) {
      ErrorHandler.logSystem('FirestoreAuthAdapter', `Aviso al conectar con Firestore: ${error.message}. Continuando con directorio temporal.`);
    }
  }

  async afterSaveCreds(): Promise<void> {
    try {
      if (!fs.existsSync(this.localDir)) return;

      const files = fs.readdirSync(this.localDir);
      const batch = this.firestore.batch();
      const collectionRef = this.firestore.collection(this.collectionName);

      const currentDiskFiles = new Set<string>();

      for (const fileName of files) {
        const filePath = path.join(this.localDir, fileName);
        if (fs.statSync(filePath).isFile()) {
          currentDiskFiles.add(fileName);
          const content = fs.readFileSync(filePath, 'utf-8');
          // Sanear el id por si contiene slashes
          const docId = fileName.replace(/\//g, '___');
          const docRef = collectionRef.doc(docId);
          batch.set(docRef, {
            content,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }

      // Eliminar de Firestore archivos borrados localmente
      const snapshot = await collectionRef.get();
      for (const doc of snapshot.docs) {
        const originalFileName = doc.id.replace(/___/g, '/');
        if (!currentDiskFiles.has(originalFileName)) {
          batch.delete(doc.ref);
        }
      }

      await batch.commit();
      ErrorHandler.logSystem('FirestoreAuthAdapter', `Credenciales de sesión sincronizadas exitosamente en Google Cloud Firestore.`);
    } catch (error: any) {
      ErrorHandler.handle('FirestoreAuthAdapter', error, { collectionName: this.collectionName });
    }
  }

  getAuthDir(): string {
    return this.localDir;
  }
}
