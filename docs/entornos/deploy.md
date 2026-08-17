# Entorno Despliegue de Producción GCP (`./ssh/deploy`)

Este documento detalla la configuración, credenciales, accesos SSH y variables de entorno necesarias para ejecutar el despliegue del bot de WhatsApp en la Servidor/VM de Producción en Google Cloud Platform (GCP) mediante el comando `./ssh/deploy` o vía **GitHub Actions**.

---

## 🎯 Descripción del Entorno

El entorno **Deploy** gestiona el ciclo de vida de producción de la aplicación en una Máquina Virtual (VM) de GCP (Compute Engine) o servidor remoto. 
- Realiza el `build` de la imagen Docker de producción (`whatsapp-firestore`).
- Realiza una parada limpia del contenedor anterior si está en ejecución.
- Inicia el nuevo contenedor en modo desacoplado (`docker compose up -d whatsapp-firestore`).
- Es invocado automáticamente por el flujo de Integración y Despliegue Continuos (**CI/CD**) en `.github/workflows/deploy.yml` en cada `push` a la rama `main`.

- **Comando de ejecución**: `./ssh/deploy`
- **Servicio Docker Compose**: `whatsapp-firestore` (Perfil Compose: `firestore`)

---

## ⚙️ Variables de Entorno y Secretos

El proceso de despliegue requiere dos conjuntos de variables y credenciales: las variables de ejecución de la aplicación en el servidor (`.env`) y los Secretos de SSH en el repositorio de GitHub.

### 1. Variables de Aplicación en el Servidor (`.env`)

| Variable | Valor de Producción | Descripción |
| :--- | :--- | :--- |
| `INTERFACE` | `baileys` | Interfaz real de WhatsApp. |
| `FLOW_FILE` | `flow_cfp412.json` | Flujo de decisión conversacional de producción. |
| `LEADS_STORAGE_TYPE` | `google_sheets` | Persistencia en Google Sheets. |
| `AUTH_STORAGE_TYPE` | `firestore` | Persistencia de sesión en GCP Firestore. |
| `GCP_PROJECT_ID` | `cfp412-agente` | ID de proyecto GCP. |
| `DATABASE` / `FIRESTORE_DATABASE_ID` | `cfp412-whatsapp` | ID de la base de datos Firestore dentro de GCP. |
| `FIRESTORE_COLLECTION_NAME` | `whatsapp_auth` | Colección para la sesión. |
| `GOOGLE_SPREADSHEET_ID` | *Spreadsheet ID* | ID de la hoja de Google Sheets. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | *Email Service Account* | Email del bot GCP. |
| `GOOGLE_PRIVATE_KEY` | *RSA Private Key* | Clave privada formateada. |
| `LOG_ADAPTER` | `gcp` / `file` | Adaptador de registros del sistema. |

### 2. Secretos de GitHub Actions (`GitHub Secrets`)

Para permitir que el flujo de CI/CD automatizado despliegue los cambios mediante SSH en la VM de GCP, se deben configurar los siguientes **Repository Secrets** en GitHub:

| Secreto en GitHub | Descripción |
| :--- | :--- |
| `GCP_VM_HOST` | Dirección IP pública o nombre de dominio de la Máquina Virtual GCP. |
| `GCP_VM_USERNAME` | Usuario SSH de Linux en la VM de GCP (ej: `ubuntu` o `lucas`). |
| `GCP_VM_SSH_KEY` | Contenido completo de la clave privada SSH autorizada en la VM. |

---

## 🔑 Credenciales SSH: Paso a Paso para Crearlas y Configurarlas

### 1. Generar Par de Claves SSH en tu Equipo

En tu terminal local, genera un par de claves SSH dedicado para el despliegue:

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/gcp_deploy_key -N ""
```

Esto generará dos archivos:
- Clave privada: `~/.ssh/gcp_deploy_key`
- Clave pública: `~/.ssh/gcp_deploy_key.pub`

### 2. Configurar la Clave Pública en la VM de GCP

1. Conéctate a tu VM en GCP vía SSH o desde la consola de GCP.
2. Abre o crea el archivo de claves autorizadas en la VM:
   ```bash
   nano ~/.ssh/authorized_keys
   ```
3. Copia todo el contenido de la clave pública `~/.ssh/gcp_deploy_key.pub` y pégalo en el archivo `authorized_keys`.
4. Asegura los permisos correctos en la VM:
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

### 3. Configurar los Secretos en GitHub

1. Ingresa a tu repositorio en **GitHub**.
2. Ve a **Settings** > **Secrets and variables** > **Actions**.
3. Haz clic en **New repository secret** y agrega cada uno de los tres secretos:

   - **Secret 1**:
     - **Name**: `GCP_VM_HOST`
     - **Value**: La IP pública de tu servidor GCP (ej. `34.123.45.67`).
   
   - **Secret 2**:
     - **Name**: `GCP_VM_USERNAME`
     - **Value**: El nombre del usuario SSH en la VM (ej. `ubuntu`).
   
   - **Secret 3**:
     - **Name**: `GCP_VM_SSH_KEY`
     - **Value**: Todo el contenido de la clave privada `~/.ssh/gcp_deploy_key` (incluyendo `-----BEGIN OPENSSH PRIVATE KEY-----` y `-----END OPENSSH PRIVATE KEY-----`).

---

## 🛠️ Requisitos Previos en el Servidor / VM de GCP

Para que el script `./ssh/deploy` o la acción de GitHub desplieguen correctamente, la máquina remota debe cumplir con los siguientes requisitos:

1. **Docker Engine y Docker Compose V2**: Debe estar instalado en la VM.
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```
2. **Permisos de Usuario SSH sin Sudo**: El usuario SSH (configurado en `GCP_VM_USERNAME`) debe pertenecer al grupo `docker` para poder ejecutar comandos de Docker sin requerir `sudo`:
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```
3. **Directorio Estandarizado de Aplicación (`~/app`)**: El pipeline de CI/CD fija como directorio destino directo `$HOME/app` (`~/app`). Si en la VM existía el proyecto bajo `~/Prueba-Whatsapp`, el flujo lo renombrará automáticamente a `~/app` de forma transparente.
4. **PATH para Sesiones SSH No Interactivas**: Los ejecutables de `docker` y `docker-compose` deben ser accesibles desde rutas globales (`/usr/bin`, `/usr/local/bin` o `/snap/bin`).

---

## 🚀 Despliegue Manual o Automático

### Despliegue Manual en el Servidor
Si estás dentro del servidor o máquina remota:
```bash
./ssh/deploy
```

### Monitoreo de Logs en Producción
Para revisar los logs en tiempo real o escanear el QR en producción:
```bash
docker compose logs -f whatsapp-firestore
```

---

## ❓ Solución de Problemas Frecuentes

### 🚨 Error: `err: ./ssh/deploy: line 12: docker: command not found (Process exited with status 127)`

**Causa**: Este error ocurre cuando la sesión SSH no interactiva ejecutada por el flujo CI/CD no encuentra el comando `docker` en su variable `$PATH`, o cuando Docker no está instalado en la Máquina Virtual remota.

**Pasos de Resolución**:
1. Conéctate vía SSH directamente a la VM de GCP:
   ```bash
   ssh -i ~/.ssh/gcp_deploy_key ubuntu@<IP_PUBLICA_GCP>
   ```
2. Verifica si Docker está instalado ejecutando `docker --version`.
3. Si `docker` no está instalado, instálalo con:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
4. Agrega tu usuario al grupo docker:
   ```bash
   sudo usermod -aG docker $USER
   ```
5. Verifica que el binario de Docker se encuentre en una ruta del PATH estándar como `/usr/bin/docker` o `/usr/local/bin/docker`. El script `./ssh/deploy` y la GitHub Action exportan automáticamente `export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/snap/bin` para garantizar su localización en entornos no interactivos.
