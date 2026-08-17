# Guía de Interacción del Agente de IA (`agent.md`)

Este documento sirve como la guía base y contexto fundamental para cualquier interacción entre el usuario y el Asistente de IA (Agente) en este proyecto.

---

## 🎯 Visión General del Proyecto
Este repositorio contiene un **WhatsApp Bot minimalista y modular** construido en TypeScript sobre **Arquitectura Hexagonal**. El sistema interactúa mediante un árbol de decisión conversacional (motor de decisiones) y se ejecuta y empaqueta íntegramente con **Docker** para garantizar paridad entre entornos de desarrollo y despliegue automatizado en Google Cloud Platform (GCP).

---

## 🏗️ Arquitectura y Principios de Diseño

1. **Arquitectura Hexagonal (Puertos y Adaptadores)**:
   - `src/domain/`: Entidades, interfaces de repositorios, contratos de adaptadores y lógica de negocio pura.
   - `src/application/`: Casos de uso y servicios de aplicación.
   - `src/infrastructure/`: Implementaciones concretas de adaptadores (Baileys, Redis, Firestore, Google Sheets, File System, Pino/Cloud Logging).
   - `src/config/`: Carga centralizada de configuraciones (`loadConfig()`).

2. **Desacoplamiento Estricto**:
   - **Interfaz de Comunicación**: Intercambiable dinámicamente entre `command` (CLI interactivo) y `baileys` (WhatsApp).
   - **Autenticación NoSQL de Sesión**: Intercambiable mediante `AUTH_STORAGE_TYPE` (`redis` para desarrollo local / `firestore` para GCP).
   - **Persistencia de Leads**: Estrategias configurables en `LEADS_STORAGE_TYPE` (`csv`, `google_sheets`, `composite`).
   - **Observabilidad y Logs**: Sistema centralizado vía `LOG_ADAPTER` (`file`, `gcp`, `console`). El directorio por defecto para los logs guardados en disco (`LOG_ADAPTER=file`) es `./logs`, montado como volumen persistente en `docker-compose.yml`.

3. **Librería Externa `motor-decision`**:
   - La lógica conversacional reside en `./motorDecision` (gestionada como dependencia local precompilada en `package.json`).
   - Debe mantenerse estrictamente desacoplada de la infraestructura y datos específicos de negocio.

---

## 🐳 Ejecución y Comandos en Docker (Carpeta `ssh/`)

> **REGLA FUNDAMENTAL**: Toda verificación, linter, pruebas y ejecuciones del proyecto **deben realizarse siempre a través de Docker**, utilizando preferentemente los scripts ubicados en el directorio `./ssh/`.

El directorio `./ssh/` contiene scripts listos para interactuar con los contenedores:

| Script | Descripción y Uso |
| :--- | :--- |
| **`./ssh/test`** | Ejecuta la suite de pruebas (**Jest**) dentro de un contenedor Docker aislado. |
| **`./ssh/lint`** | Ejecuta la verificación de tipos TypeScript (`tsc --noEmit`) y **ESLint** dentro de Docker. |
| **`./ssh/deploy`** | Construye la imagen de producción y levanta el contenedor `whatsapp-bot` en segundo plano. |
| **`./ssh/cli`** | Inicia el bot en modo consola CLI interactivo dentro de Docker (`INTERFACE=command`). |
| **`./ssh/whatsapp`** | Inicia la interfaz WhatsApp Baileys dentro de Docker en primer plano (para ver logs y QR). |
| **`./ssh/cli-googlesheet`** | Inicia el modo CLI probando la integración con Google Sheets en Docker. |
| **`./ssh/whatsapp-storage`** | Inicia la interfaz de WhatsApp configurando adaptadores de sesión NoSQL. |
| **`./ssh/whatsapp-firebase`** | Inicia el despliegue del bot con autenticación NoSQL en Firestore/Firebase y persistencia de leads en Google Sheets. |

---

## 📋 Reglas y Protocolo de Interacción para el Agente

### 1. Antes de Modificar Código
- **Comprender el contexto**: Revisar las interfaces del dominio y la arquitectura existente antes de aplicar refactorizaciones o agregar características.
- **Mantener la configuración centralizada**: Usar exclusivamente `loadConfig()` en `src/config/config.ts`. Evitar consultar `process.env` directamente fuera de los módulos de configuración.

### 2. Estándares de Código y Calidad
- **TypeScript Estricto**: Definir tipos e interfaces claras para todas las funciones, parámetros y retornos. Evitar el uso de `any`.
- **Manejo de Errores y Logging**: Utilizar siempre el `LoggerFactory` o `ErrorHandler` centralizado. **No utilizar `console.log` o `console.error` sueltos en código de producción**.
- **Conservación de Comentarios**: Mantener los comentarios descriptivos y la documentación técnica de las funciones salvo que la tarea indique explícitamente lo contrario.

### 3. Pruebas Unitarias e Integración (Testing)
- **Suite de Pruebas**: Toda modificación o nueva funcionalidad debe contar con pruebas unitarias o de integración en `src/tests/` utilizando **Jest**.
- **Verificación**: Verificar siempre la suite ejecutando `./ssh/test` y `./ssh/lint` en Docker antes de finalizar la tarea.

### 4. Despliegue y Entorno
- Respetar los archivos de configuración de infraestructura (`Dockerfile`, `docker-compose.yml`, `ssh/deploy` y `.github/workflows/deploy.yml`).

---

## 💬 Estilo de Comunicación del Agente
- **Idioma**: Español.
- **Claridad**: Respuestas concisas, bien estructuradas en sintaxis Markdown.
- **Transparencia**: Resumir los cambios realizados, indicando componentes o archivos afectados y confirmando el paso de las pruebas.
