# Minimalist WhatsApp Bot con TypeScript y Docker

Este es un bot minimalista para WhatsApp que responde según el árbol de decisiones conversacional definido.
Utiliza `@whiskeysockets/baileys` para la conexión y está empaquetado con Docker para su fácil despliegue.

## Requisitos previos

- Docker
- Docker Compose

## Cómo iniciar el proyecto

1. En la raíz del proyecto, ejecuta el siguiente comando para construir y levantar el contenedor y sus servicios (incluyendo Redis):
   ```bash
   docker compose up --build
   ```

2. En los logs de la consola aparecerá un código QR. Abre WhatsApp en tu teléfono, ve a **Dispositivos Vinculados** y escanea el QR.
3. Una vez vinculado, verás el mensaje `¡Bot de WhatsApp conectado y listo para recibir mensajes!` en la consola.
4. Si quieres dejar el bot corriendo en segundo plano y salir de la vista de logs de Docker, puedes presionar `Ctrl + C` o haberlo iniciado con `docker compose up -d`.
5. Para ver los logs nuevamente puedes usar:
   ```bash
   docker compose logs -f whatsapp-bot
   ```

## Estructura y Persistencia de Sesión

Para evitar la volatilidad del contenedor sin depender del sistema de archivos local, el almacenamiento de credenciales de sesión se gestiona con bases de datos NoSQL:

- **Desarrollo Local (`redis`)**: La sesión se guarda en una instancia de **Redis** en Docker (`RedisAuthAdapter`). El servicio de Redis se levanta automáticamente vía Docker Compose.
- **Producción (`firestore` / `gcf`)**: La sesión se guarda de forma persistente y distribuida en **Google Cloud Firestore** (`FirestoreAuthAdapter`).

## Variables de Configuración

El sistema maneja su configuración centralizada a través de `src/config/config.ts` (`loadConfig()`). La configuración se puede definir en `src/config/config.json` y sobrescribir mediante el archivo `.env` o variables de entorno del sistema.

### 1. Interfaz y Motor Principal

| Variable | Valores Posibles | Por Defecto | Descripción y Uso |
| :--- | :--- | :--- | :--- |
| `INTERFACE` | `command` \| `baileys` | `command` | **`src/app.ts`**: Determina el modo de ejecución (`command` para consola interactiva CLI / `baileys` para bot WhatsApp). |
| `FLOW_FILE` | *string* | `flow_cfp412.json` | **`src/app.ts` / `JsonFlowAdapter`**: Archivo JSON en `/flows` con el árbol de decisión conversacional. |

### 2. Almacenamiento de Leads

| Variable | Valores Posibles | Por Defecto | Descripción y Uso |
| :--- | :--- | :--- | :--- |
| `LEADS_STORAGE_TYPE` | `csv` \| `google_sheets` \| `composite` | `csv` | **`LeadRepositoryFactory`**: Estrategia de persistencia de contactos y listas de espera (`csv` local, `google_sheets` en la nube, o `composite` simultáneo). |

### 3. Autenticación y Sesión de WhatsApp (NoSQL)

| Variable | Valores Posibles | Por Defecto | Descripción y Uso |
| :--- | :--- | :--- | :--- |
| `AUTH_STORAGE_TYPE` *(o `AUTH_ADAPTER`)* | `redis` \| `firestore` (o `gcf`) | `redis` | **`AuthStorageFactory`**: Selecciona el adaptador de sesión NoSQL (`redis` para desarrollo local / `firestore` para producción en GCP). |
| `REDIS_HOST` | *string* | `localhost` / `redis` | **`RedisAuthAdapter`**: Host de Redis en entorno local. |
| `REDIS_PORT` | *number* | `6379` | **`RedisAuthAdapter`**: Puerto de la base de datos Redis. |
| `REDIS_PASSWORD` | *string* | *vacío* | **`RedisAuthAdapter`**: Contraseña de acceso a Redis (opcional). |
| `FIRESTORE_COLLECTION_NAME` | *string* | `whatsapp_auth` | **`FirestoreAuthAdapter`**: Nombre de la colección en Firestore para credenciales de bot. |
| `GCP_PROJECT_ID` | *string* | *auto* | **`FirestoreAuthAdapter`**: ID de proyecto GCP para Google Cloud Firestore. |

### 4. Sistema de Logs y Observabilidad

| Variable | Valores Posibles | Por Defecto | Descripción y Uso |
| :--- | :--- | :--- | :--- |
| `LOG_ADAPTER` *(o `LOG_TYPE`)* | `file` \| `gcp` (o `google`) \| `console` | `file` | **`LoggerFactory` / `ErrorHandler`**: Adaptador de logs (`file` para archivos locales rotativos `system.log`/`errors.log`, `gcp` para Cloud Logging, `console` para stdout). |
| `LOG_DIR` | *path* | `./data` | **`FileLoggerAdapter`**: Directorio donde se guardan los logs si `LOG_ADAPTER=file`. |

### 5. Integración con Google Sheets

| Variable | Valores Posibles | Por Defecto | Descripción y Uso |
| :--- | :--- | :--- | :--- |
| `GOOGLE_SPREADSHEET_ID` | *string* | `""` | **`GoogleSheetsAdapter`**: ID de la hoja de cálculo de Google Sheets. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | *email* | `""` | **`GoogleSheetsAdapter` / `FirestoreAuthAdapter`**: Correo de la Service Account de Google Cloud. |
| `GOOGLE_PRIVATE_KEY` | *string (RSA)* | `""` | **`GoogleSheetsAdapter` / `FirestoreAuthAdapter`**: Clave privada RSA de la Service Account para autenticación JWT. |
| `GOOGLE_SHEETS_TAB_CONTACTOS` | *string* | `Contactos` | **`GoogleSheetsLeadRepository`**: Nombre de la pestaña para guardar contactos. |
| `GOOGLE_SHEETS_TAB_LISTA_ESPERA` | *string* | `ListaEspera` | **`GoogleSheetsLeadRepository`**: Nombre de la pestaña para guardar lista de espera. |

## Despliegue Automatizado (CI/CD)

El proyecto incluye un pipeline de CI/CD automatizado con **GitHub Actions** (`.github/workflows/deploy.yml`). Al realizar un `push` a la rama `main`, la aplicación se construye, valida y despliega automáticamente en la Servidor/VM de Google Cloud Platform (GCP).

### Secretos de GitHub (`GitHub Secrets`)

Para habilitar la conexión SSH y el despliegue automático, se utilizan los siguientes secretos en el repositorio:

| Secreto en GitHub | Descripción y Uso |
| :--- | :--- |
| **`GCP_VM_HOST`** | Dirección IP pública o nombre de dominio de la máquina virtual (VM) en GCP. |
| **`GCP_VM_USERNAME`** | Usuario SSH de Linux en la VM de GCP (ej: `ubuntu` o `lucas`). |
| **`GCP_VM_SSH_KEY`** | Clave privada SSH autorizada en la VM para autenticación automatizada. |
