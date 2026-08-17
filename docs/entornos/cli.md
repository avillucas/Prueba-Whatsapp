# Entorno CLI Local (`./ssh/cli`)

Este documento detalla la configuración, credenciales y variables de entorno necesarias para ejecutar el bot de WhatsApp en modo consola interactiva local mediante el comando `./ssh/cli`.

---

## 🎯 Descripción del Entorno

El entorno **CLI Local** permite interactuar de forma manual mediante la consola de la terminal con el motor conversacional de árbol de decisiones. 
Es ideal para probar flujos de diálogo, validar cambios en `flows/flow_cfp412.json` o depurar lógica de negocio sin requerir una conexión activa a WhatsApp ni credenciales de servicios en la nube.

- **Comando de ejecución**: `./ssh/cli`
- **Servicio / Perfil Docker**: `whatsapp-cli` (Perfil Compose: `cli`)
- **Contenedor resultante**: `cli-bot`
- **Almacenamiento de Leads**: Archivo CSV local (`./data/leads.csv`)

---

## ⚙️ Variables de Entorno

A continuación se detallan las variables de entorno utilizadas por este script y el contenedor Docker:

| Variable | Valor por Defecto | Valores Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `INTERFACE` | `command` | `command` | Establece el adaptador de entrada a modo consola interactiva. |
| `FLOW_FILE` | `flow_cfp412.json` | *nombre_archivo.json* | Nombre del archivo del árbol de decisiones ubicado en la carpeta `./flows/`. |
| `LEADS_STORAGE_TYPE` | `csv` | `csv` | Define el almacenamiento de leads en un archivo CSV local. |
| `AUTH_STORAGE_TYPE` | `redis` / `file` | `redis` \| `file` | Adaptador de sesión (no se requiere conexión a WhatsApp en este entorno). |
| `LOG_ADAPTER` | `file` | `file` \| `console` | Adaptador de logs (`file` escribe en `./logs/system.log`, `console` imprime a stdout). |
| `LOG_DIR` | `./logs` | *path* | Ruta del directorio persistente para logs. |

---

## 🔑 Credenciales y Requisitos de Acceso

### ¿Requiere credenciales externas?
**No.** Este entorno opera de manera 100% aislada e in-memory/local. No se requiere autenticación con Google Cloud, Firestore, Google Sheets ni WhatsApp Web.

### Configuración del Entorno Local

1. Asegúrate de contar con el archivo de configuración de entorno `.env` en la raíz del proyecto. Si no existe, puedes crearlo copiando el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Verifica que el archivo conversacional `./flows/flow_cfp412.json` exista y contenga un árbol de decisión válido.

3. Para iniciar el entorno interactivo, ejecuta:
   ```bash
   ./ssh/cli
   ```

4. Escribe mensajes en la consola para simular la conversación del usuario con el bot. Para salir de la consola interactiva presiona `Ctrl + C`.
