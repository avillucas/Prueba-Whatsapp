# Entorno CLI con Google Sheets (`./ssh/cli-googlesheet`)

Este documento detalla la configuración, credenciales y variables de entorno necesarias para ejecutar la consola interactiva con exportación directa de leads a **Google Sheets** mediante el comando `./ssh/cli-googlesheet`.

---

## 🎯 Descripción del Entorno

El entorno **CLI Google Sheets** permite probar de forma interactiva la captura de leads del bot WhatsApp mediante consola, pero sincronizando los contactos y listas de espera directamente a una hoja de cálculo en la nube de **Google Sheets** en lugar de guardarlos solo en CSV local.

- **Comando de ejecución**: `./ssh/cli-googlesheet`
- **Servicio / Perfil Docker**: `whatsapp-cli` (Perfil Compose: `cli`)
- **Contenedor resultante**: `cli-googlesheet`
- **Almacenamiento de Leads**: Google Sheets (`google_sheets`)

---

## ⚙️ Variables de Entorno

| Variable | Valor por Defecto | Obligatorio | Descripción |
| :--- | :--- | :--- | :--- |
| `INTERFACE` | `command` | Sí | Adaptador de entrada por consola interactiva. |
| `FLOW_FILE` | `flow_cfp412.json` | Sí | Nombre del árbol de conversación en `./flows/`. |
| `LEADS_STORAGE_TYPE` | `google_sheets` | Sí | Forzado en el script a `google_sheets`. |
| `GOOGLE_SPREADSHEET_ID` | *Definido en `.env`* | **Sí** | ID de la hoja de cálculo de Google Sheets destino. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | *Definido en `.env`* | **Sí** | Correo electrónico de la Cuenta de Servicio (*Service Account*) de GCP. |
| `GOOGLE_PRIVATE_KEY` | *Definido en `.env`* | **Sí** | Clave privada RSA de la Service Account en formato multilínea o con `\n`. |
| `GOOGLE_SHEETS_TAB_CONTACTOS` | `Contactos` | No | Nombre de la pestaña para almacenar los leads de contactos. |
| `GOOGLE_SHEETS_TAB_LISTA_ESPERA` | `ListaEspera` | No | Nombre de la pestaña para almacenar la lista de espera. |

---

## 🔑 Credenciales: Paso a Paso para Crearlas y Obtenerlas

Para que la aplicación pueda escribir datos en Google Sheets, es indispensable contar con una **Service Account de Google Cloud** y un **Spreadsheet** preparado.

### 1. Crear una Cuenta de Servicio en Google Cloud Platform (GCP)

1. Ingresa a la [Consola de Google Cloud](https://console.cloud.google.com/).
2. Selecciona o crea un proyecto (ej. `cfp412-agente`).
3. Ve a **APIs y servicios** > **Biblioteca**.
4. Busca **Google Sheets API** y haz clic en **Habilitar**.
5. Ve a **IAM y administración** > **Cuentas de servicio**.
6. Haz clic en **Crear cuenta de servicio**:
   - **Nombre**: `whatsapp-leads-bot` (o el de tu preferencia).
   - **ID de cuenta de servicio**: se autogenera.
   - Haz clic en **Crear y continuar**.
7. (Opcional) En asignación de roles, no se requieren roles de organización específicos para Sheets, pero si usas Firestore o Cloud Logging en el mismo proyecto, asigna *Cloud Datastore User*.
8. Haz clic en **Listo**.

### 2. Generar y Descargar la Clave Privada JSON

1. En la lista de Cuentas de Servicio, haz clic sobre la cuenta recién creada (`whatsapp-leads-bot@...`).
2. Ve a la pestaña **Claves** (*Keys*).
3. Haz clic en **Agregar clave** > **Crear clave nueva**.
4. Selecciona el tipo **JSON** y haz clic en **Crear**.
5. Se descargará un archivo JSON a tu computadora (ejemplo: `proyecto-xxxx.json`).

### 3. Crear y Configurar la Hoja de Google Sheets

1. Abre Google Sheets en [sheets.new](https://sheets.new) y crea una nueva planilla.
2. Copia el **ID de la hoja de cálculo** de la URL del navegador.
   - Ejemplo de URL: `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit`
   - El ID es: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`
3. En la parte inferior de la hoja, crea/renombra dos pestañas:
   - `Contactos`
   - `ListaEspera`
4. Haz clic en el botón **Compartir** en la esquina superior derecha:
   - Pega el correo de la Service Account (obtenido del JSON en el campo `"client_email"`, ej. `whatsapp-leads-bot@cfp412-agente.iam.gserviceaccount.com`).
   - Otorga el rol de **Editor**.
   - Desmarca "Notificar a los usuarios" y haz clic en **Compartir**.

---

## 📝 Configuración del Archivo `.env`

Edita o crea el archivo `.env` en la raíz de tu proyecto e ingresa las credenciales obtenidas:

```env
INTERFACE=command
FLOW_FILE=flow_cfp412.json
LEADS_STORAGE_TYPE=google_sheets

# Credenciales de Google Sheets
GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SERVICE_ACCOUNT_EMAIL=whatsapp-leads-bot@cfp412-agente.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDbKibu2RQixWzW...\n-----END PRIVATE KEY-----\n"

GOOGLE_SHEETS_TAB_CONTACTOS=Contactos
GOOGLE_SHEETS_TAB_LISTA_ESPERA=ListaEspera
```

> [!TIP]
> Asegúrate de encerrar la `GOOGLE_PRIVATE_KEY` entre comillas dobles `"` y conservar los caracteres `\n` para representar los saltos de línea de la clave RSA.

---

## 🚀 Ejecución del Entorno

Ejecuta el script desde la raíz del proyecto:

```bash
./ssh/cli-googlesheet
```

Al completar una conversación en la CLI, verifica en tu hoja de Google Sheets que los datos del contacto o lista de espera hayan sido agregados en la pestaña correspondiente.
