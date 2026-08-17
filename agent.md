# Guía de Interacción del Agente de IA (`agent.md`)

Este documento sirve como la guía base y contexto fundamental para cualquier interacción entre el usuario y el Asistente de IA (Agente) en este proyecto.

---

## 🎯 Visión General del Proyecto
Este repositorio contiene un **WhatsApp Bot minimalista y modular** construido en TypeScript sobre **Arquitectura Hexagonal**. El sistema interactúa mediante un árbol de decisión conversacional (motor de decisiones) y se ejecuta y empaqueta íntegramente con **Docker** y **Docker Compose Profiles** para garantizar paridad entre entornos de desarrollo local y despliegue automatizado en Google Cloud Platform (GCP).

---

## 🏗️ Arquitectura e Infraestructura

### 1. Arquitectura Hexagonal (Puertos y Adaptadores)
- `src/domain/`: Entidades, interfaces de repositorios, contratos de adaptadores y lógica de negocio pura.
- `src/application/`: Casos de uso y servicios de aplicación.
- `src/infrastructure/`: Implementaciones concretas de adaptadores (Baileys, Redis, Firestore, Google Sheets, File System, Pino/Cloud Logging).
- `src/config/`: Carga centralizada de configuraciones (`loadConfig()` en `src/config/config.ts`).

### 2. Sincronización de Librerías Locales
- La lógica conversacional reside en `./motorDecision` (gestionada como dependencia local en `package.json` vía `file:./motorDecision`).
- El script de inicialización centralizado (`ssh/_common.sh`) detecta y sincroniza automáticamente los artefactos precompilados de `../motorDecision` hacia `./motorDecision` antes de cualquier compilación o ejecución en Docker.

### 3. Matriz de Variables de Entorno y Perfiles

| Perfil | `INTERFACE` | `AUTH_STORAGE_TYPE` | `LEADS_STORAGE_TYPE` | `LOG_ADAPTER` | Descripción y Servicios Docker |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CLI Local** | `command` | `redis` / `file` | `csv` | `console` / `file` | Ejecución en consola interactiva (`whatsapp-cli`). |
| **CLI Sheets** | `command` | `redis` / `file` | `google_sheets` | `console` / `file` | Prueba CLI con exportación a Google Sheets (`whatsapp-cli`). |
| **WhatsApp Local** | `baileys` | `redis` | `csv` | `file` | Bot con escaneo QR y backend de sesión en Redis (`whatsapp-local` + `redis`). |
| **WhatsApp Firebase**| `baileys` | `firestore` | `google_sheets` | `file` / `gcp` | Despliegue GCP con sesión Firestore y leads en Google Sheets (`whatsapp-firebase`). |
| **Test & Lint** | `command` | `file` | `csv` | `console` | Ejecución aislada de Jest y ESLint en Docker (`whatsapp-test`). |

### 4. Gestión de Volúmenes y Persistencia
Todos los entornos aseguran y montan los siguientes volúmenes persistentes en el contenedor:
- `./auth_info:/app/auth_info`: Credenciales y claves de sesión de WhatsApp (almacenamiento local `file`).
- `./data:/app/data`: Salida de leads exportados en formato CSV.
- `./logs:/app/logs`: Archivos de registro del sistema (vía Pino logger).
- `./flows:/app/flows`: Archivos JSON con árboles de decisión (e.g. `flow_cfp412.json`).
- `redis_data:/data`: Volumen nombrado de Docker para persistencia de datos en Redis.

---

## 🐳 Ejecución y Comandos en Docker (Carpeta `ssh/`)

> **REGLA FUNDAMENTAL**: Toda verificación, linter, pruebas y ejecuciones del proyecto **deben realizarse siempre a través de Docker**, utilizando los scripts estandarizados en `./ssh/`. Todos invocan `ssh/_common.sh` para garantizar sincronización de librerías y preparación de volúmenes.

| Script | Descripción y Perfil Docker |
| :--- | :--- |
| **`./ssh/test`** | Ejecuta la suite de pruebas (**Jest**) dentro del contenedor `whatsapp-test`. |
| **`./ssh/lint`** | Ejecuta la verificación de tipos TypeScript (`tsc --noEmit`) y **ESLint** dentro de Docker. |
| **`./ssh/deploy`** | Construye y levanta el servicio `whatsapp-firebase` de producción en segundo plano via Compose. |
| **`./ssh/cli`** | Inicia el bot en modo consola CLI interactivo dentro de Docker (`whatsapp-cli`). |
| **`./ssh/whatsapp`** | Inicia la interfaz de WhatsApp Baileys con soporte Redis (`whatsapp-local` + `redis`). |
| **`./ssh/cli-googlesheet`** | Inicia el modo CLI interactivo probando la integración con Google Sheets. |
| **`./ssh/whatsapp-storage`** | Inicia el bot de WhatsApp con adaptadores de sesión NoSQL (Redis / Firestore). |
| **`./ssh/whatsapp-firebase`** | Inicia el despliegue del bot con sesión en Firestore/Firebase y leads en Google Sheets. |

---

## 📋 Reglas y Protocolo de Interacción para el Agente

### 1. Antes de Modificar Código
- **Comprender el contexto**: Revisar las interfaces del dominio y la arquitectura existente antes de aplicar refactorizaciones.
- **Configuración centralizada**: Usar exclusivamente `loadConfig()` en `src/config/config.ts`. Evitar consultar `process.env` directamente fuera de los módulos de configuración.

### 2. Estándares de Código y Calidad
- **TypeScript Estricto**: Definir tipos e interfaces claras para todas las funciones, parámetros y retornos. Evitar el uso de `any`.
- **Manejo de Errores y Logging**: Utilizar siempre el `LoggerFactory` o `ErrorHandler` centralizado. No utilizar `console.log` sueltos en código de producción.

### 3. Pruebas Unitarias e Integración (Testing)
- **Suite de Pruebas**: Toda modificación debe contar con pruebas unitarias o de integración en `src/tests/` utilizando **Jest**.
- **Verificación**: Verificar siempre la suite ejecutando `./ssh/test` y `./ssh/lint` en Docker antes de finalizar la tarea.

### 4. Despliegue y Entorno
- Respetar los archivos de configuración de infraestructura (`Dockerfile`, `docker-compose.yml`, `ssh/_common.sh`, `ssh/deploy` y `.github/workflows/deploy.yml`).

---

## 💬 Estilo de Comunicación del Agente
- **Idioma**: Español.
- **Claridad**: Respuestas concisas, bien estructuradas en sintaxis Markdown.
- **Transparencia**: Resumir los cambios realizados, indicando componentes o archivos afectados y confirmando el paso de las pruebas.
