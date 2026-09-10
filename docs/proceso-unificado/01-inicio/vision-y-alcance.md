# Visión y alcance

## Producto

El sistema es un bot de WhatsApp desarrollado en TypeScript que guía conversaciones mediante árboles de decisión JSON, captura datos de interesados y permite operar la conexión de WhatsApp desde entornos locales o de producción.

## Objetivos

- Responder consultas frecuentes del CFP 412 mediante flujos configurables.
- Capturar datos para lista de espera y consultas personalizadas.
- Persistir leads en CSV, Google Sheets o ambas opciones.
- Mantener credenciales de WhatsApp en almacenamiento local, Redis o Firestore.
- Proporcionar operación por CLI y por WhatsApp mediante Baileys.
- Centralizar logs y permitir observabilidad local o en GCP.
- Administrar la conexión y los flujos mediante el panel web protegido.
- Ejecutar pruebas, lint y despliegue con Docker y scripts SSH.

## Alcance funcional

Incluye recepción y procesamiento de mensajes, navegación por el árbol de decisión, extracción y validación de datos, cierre y reinicio de conversaciones, persistencia de leads, gestión de sesiones, autenticación de WhatsApp, panel administrativo y selección de flujos.

## Fuera de alcance

- Implementar WhatsApp como proveedor oficial de la API.
- Resolver automáticamente consultas personalizadas mediante inteligencia artificial.
- Administrar contenidos académicos desde un CMS externo.
- Sustituir las políticas de seguridad de Google Cloud, Redis o WhatsApp.

## Restricciones y decisiones actuales

- La lógica conversacional se mantiene en archivos JSON dentro de `flows/`.
- El motor conversacional se consume desde `motorDecision/` como dependencia local.
- La configuración se centraliza en `src/config/config.ts` y `src/config/config.json`.
- Los entornos se ejecutan mediante Docker Compose y los scripts de `ssh/`.
- El flujo predeterminado actual es `flow_cfp412` con nodo inicial `MSG_INICIAL`.

## Criterios de éxito

- Un usuario puede completar un flujo informativo o de captura sin intervención manual.
- Los datos capturados llegan al repositorio configurado.
- La sesión de WhatsApp se recupera después de reiniciar el contenedor.
- Los flujos pueden actualizarse sin modificar el código de la aplicación.
- Los entornos de prueba y despliegue son reproducibles mediante los scripts existentes.
