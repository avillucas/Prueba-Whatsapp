# Prompt de Migración a Nuevo Proyecto

Este directorio (`migracion/`) contiene todas las implementaciones específicas y concretas de tu aplicación (interfaces, persistencia, adaptadores de WhatsApp y flujos de ejemplo). La librería principal (`motorDecision`) ahora se mantiene completamente agnóstica de estas responsabilidades.

Si vas a llevar esto a un nuevo proyecto o pasárselo a otra IA para continuar el desarrollo, utiliza la siguiente descripción como contexto (prompt) para explicar qué hace cada archivo y cómo se integran:

---

## 🤖 Contexto para la IA / Nuevo Proyecto

**Objetivo:** Integrar los adaptadores de comunicación, persistencia y casos de uso específicos que fueron separados de la librería central de motor de decisión. 

A continuación se detalla qué es y para qué sirve cada archivo dentro de esta carpeta, para que sepas cómo conectarlos a la librería base del motor de decisión:

### 1. Adaptadores de Entrada/Salida (Interfaces)
- **`WhatsAppAdapter.ts`**: Es el adaptador principal que conecta la librería externa de WhatsApp (por ejemplo, Baileys o whatsapp-web.js) con el Motor de Decisión. Escucha mensajes entrantes, los envía al motor y devuelve la respuesta al usuario mediante la API de WhatsApp.
- **`ConsoleAdapter.ts`**: Es un adaptador de interfaz de línea de comandos (CLI). Permite simular y probar los flujos de conversación de manera local en la terminal, interactuando con el Motor de Decisión sin necesidad de levantar WhatsApp.

### 2. Acceso a Datos y Persistencia
- **`Lead.ts`**: Definición de los modelos o tipos de datos que representan a los usuarios en el dominio de tu aplicación (ej. `LeadContacto`, `LeadListaEspera`).
- **`LeadRepository.ts`**: Interfaz de persistencia que define cómo guardar estos leads.
- **`CsvLeadRepository.ts`**: Implementación concreta de la interfaz `LeadRepository` (que pertenece a la librería base). Guarda la información de los usuarios (leads) extraída de las conversaciones en archivos CSV locales.
- **`leads_data/`**: Carpeta donde `CsvLeadRepository.ts` almacena y lee los archivos de datos (ej. `contactos.csv`, `lista_espera.csv`).

### 3. Casos de Uso de Aplicación
- **`SessionLeadManager.ts`**: Es un gestor a nivel de aplicación que se encarga de consolidar los datos que un usuario proporcionó a lo largo del flujo y guardarlos en el repositorio (usando el `LeadRepository`) de manera asíncrona al finalizar la conversación.
- **`SessionLeadManager.test.ts`**: Pruebas unitarias para validar que el almacenamiento de datos de la sesión funciona correctamente.
- **`SessionIdGenerator.ts`**: Utilidad acoplada a características externas (lectura de MAC address y formateo de IDs de WhatsApp `remoteJid`) que genera un identificador único por usuario/sesión para asociar sus respuestas durante el flujo.

### 4. Mockups y Configuración del Flujo (Caso de uso CFP 412)
- **`flow_cfp412.json`**: Es el archivo JSON que define el árbol de decisión (nodos, preguntas, opciones, keywords) específico para el caso de uso del Centro de Formación Profesional 412.
- **`cfp412Mockup.ts`**: Estructuras de datos falsas (mocks) y respuestas simuladas asociadas al dominio del CFP 412, útiles para hacer pruebas sin usar datos reales.
- **`cfp412.test.ts`**: Pruebas de integración del motor de decisión utilizando específicamente el flujo definido en `flow_cfp412.json` y el mockup `cfp412Mockup.ts`.

---

### Instrucciones para el Nuevo Proyecto:
1. **Instalar el Motor:** Debes importar o instalar la librería base `motor-decision` (que ahora solo expone lógica pura de estado, transiciones y abstracciones).
2. **Reconectar Adaptadores:** Instancia el motor inyectándole `CsvLeadRepository` como dependencia de persistencia, y luego envuelve el motor utilizando `WhatsAppAdapter` (producción) o `ConsoleAdapter` (desarrollo).
3. **Flujo de Trabajo:** Utiliza `flow_cfp412.json` como tu proveedor de flujo para definir el árbol de respuestas.
