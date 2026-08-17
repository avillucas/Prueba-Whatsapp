# Entorno WhatsApp Firestore (`./ssh/whatsapp-firestore`)

Este documento detalla la configuración, credenciales y variables de entorno necesarias para ejecutar el bot de WhatsApp en entorno de producción/nube utilizando **Google Cloud Firestore** para la sesión y **Google Sheets** para la persistencia de leads mediante el comando `./ssh/whatsapp-firestore`.

---

## 🎯 Descripción del Entorno

El entorno **WhatsApp Firestore** representa la arquitectura completa lista para despliegues distribuidos o producción en la nube (como Google Cloud Virtual Machines o Cloud Run). 
- **Persistencia de Sesión NoSQL**: Utiliza `FirestoreAuthAdapter` para guardar las credenciales y estado del socket de WhatsApp en **Google Cloud Firestore**, eliminando cualquier dependencia de contenedores Redis o archivos locales.
- **Exportación de Leads**: Persiste contactos y listas de espera directamente en **Google Sheets** (`google_sheets`).
- **Sistema de Logs**: Soporta logs locales en archivo rotativo o integración directa con **Google Cloud Logging**.

- **Comando de ejecución**: `./ssh/whatsapp-firestore`
- **Servicio / Perfil Docker**: `whatsapp-firestore` (Perfil Compose: `firestore`)
- **Contenedor resultante**: `whatsapp-firestore`

---

## ⚙️ Variables de Entorno

| Variable | Valor por Defecto | Obligatorio | Descripción |
| :--- | :--- | :--- | :--- |
| `INTERFACE` | `baileys` | Sí | Habilita la interfaz de WhatsApp Web (Baileys). |
| `FLOW_FILE` | `flow_cfp412.json` | Sí | Archivo JSON con el árbol de conversación. |
| `LEADS_STORAGE_TYPE` | `google_sheets` | Sí | Guarda los leads directamente en la hoja de cálculo de Google. |
| `AUTH_STORAGE_TYPE` | `firestore` | Sí | Guarda la sesión de WhatsApp en Firestore. |
| `GCP_PROJECT_ID` | *Definido en `.env`* | **Sí** | ID del proyecto en Google Cloud Platform. |
| `DATABASE` / `FIRESTORE_DATABASE_ID` | `(default)` | No | ID de la base de datos Firestore dentro del proyecto GCP. |
| `FIRESTORE_COLLECTION_NAME` | `whatsapp_auth` | No | Nombre de la colección en Firestore para guardar claves de sesión. |
| `GOOGLE_SPREADSHEET_ID` | *Definido en `.env`* | **Sí** | ID de la hoja de cálculo de Google Sheets. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | *Definido en `.env`* | **Sí** | Correo electrónico de la Service Account de GCP. |
| `GOOGLE_PRIVATE_KEY` | *Definido en `.env`* | **Sí** | Clave privada RSA de la Service Account. |
| `LOG_ADAPTER` | `file` | No | `file` para archivos locales o `gcp` para Cloud Logging. |

---

## 🔑 Credenciales: Paso a Paso para Crearlas y Obtenerlas

Para desplegar este entorno se requieren tres componentes configurados: **GCP Firestore**, **Google Service Account** y **Google Sheets**.

### 1. Configuración de Google Cloud Firestore

1. Ingresa a la [Consola de GCP](https://console.cloud.google.com/).
2. Selecciona tu proyecto o crea uno nuevo (ej. `cfp412-agente`). Copia el **ID del proyecto** (ej. `cfp412-agente`) para la variable `GCP_PROJECT_ID`.
3. En el menú lateral, busca **Firestore** (o **Datastore**).
4. Haz clic en **Crear base de datos**.
5. Selecciona el modo **Modo Nativo de Firestore** (*Native Mode*).
6. Elige una ubicación geográfica adecuada (ej. `us-central` o `southamerica-east1`) y crea la base de datos.

### 2. Crear Service Account y Asignar Permisos IAM

1. En GCP Console, ve a **IAM y administración** > **Cuentas de servicio**.
2. Haz clic en **Crear cuenta de servicio**:
   - **Nombre**: `whatsapp-leads-bot`
   - Haz clic en **Crear y continuar**.
3. En el paso de **Otorgar acceso a esta cuenta de servicio para el proyecto**, asigna los siguientes roles:
   - **Usuario de Cloud Datastore** (*Cloud Datastore User*) -> Requerido para leer/escribir credenciales en Firestore.
   - **Escritor de registros** (*Logs Writer*) -> Opcional si utilizas `LOG_ADAPTER=gcp`.
4. Haz clic en **Continuar** y luego en **Listo**.
5. Haz clic sobre la cuenta de servicio creada (`whatsapp-leads-bot@<project_id>.iam.gserviceaccount.com`).
6. En la pestaña **Claves** (*Keys*), selecciona **Agregar clave** > **Crear clave nueva** (JSON) y descárgala.

### 3. Configurar Google Sheets

1. Crea o abre tu planilla en Google Sheets ([sheets.new](https://sheets.new)).
2. Copia el ID de la planilla desde la URL.
3. Asegúrate de tener las pestañas `Contactos` y `ListaEspera`.
4. Comparte la hoja con el correo de la Service Account (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) con rol de **Editor**.

---

## 📝 Configuración del Archivo `.env`

Completa tu archivo `.env` con los valores del proyecto de GCP y la clave del archivo JSON descargado:

```env
INTERFACE=baileys
FLOW_FILE=flow_cfp412.json
LEADS_STORAGE_TYPE=google_sheets
AUTH_STORAGE_TYPE=firestore

# GCP / Firestore
GCP_PROJECT_ID=cfp412-agente
DATABASE=cfp412-whatsapp
FIRESTORE_COLLECTION_NAME=whatsapp_auth

# Google Sheets / Service Account
GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SERVICE_ACCOUNT_EMAIL=whatsapp-leads-bot@cfp412-agente.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDbKibu2RQixWzW...\n-----END PRIVATE KEY-----\n"

GOOGLE_SHEETS_TAB_CONTACTOS=Contactos
GOOGLE_SHEETS_TAB_LISTA_ESPERA=ListaEspera

LOG_ADAPTER=file
LOG_DIR=./logs
```

---

## 🚀 Ejecución y Escaneo del QR

1. Inicia el entorno interactivo con el comando:
   ```bash
   ./ssh/whatsapp-firestore
   ```

2. El script construirá la imagen Docker y ejecutará el contenedor en consola.

3. Escanea el código QR desde tu teléfono móvil (WhatsApp > Dispositivos vinculados).

4. Una vez autenticado, Firestore almacenará los tokens de sesión bajo la colección `whatsapp_auth`.
