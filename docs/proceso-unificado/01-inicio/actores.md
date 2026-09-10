# Actores del sistema

## Actores primarios

| Actor | Tipo | Objetivo | Interacción |
|---|---|---|---|
| Usuario final de WhatsApp | Humano | Consultar información, anotarse en lista de espera o enviar una consulta. | Envía mensajes y recibe respuestas mediante WhatsApp. |
| Operador CLI | Humano | Probar o utilizar el flujo desde una consola interactiva. | Inicia el modo `command` y responde preguntas en terminal. |
| Administrador del sistema | Humano | Gestionar conexión, flujos y sesiones operativas. | Usa el panel web administrativo y los scripts de operación. |

## Actores secundarios y sistemas externos

| Actor | Tipo | Responsabilidad |
|---|---|---|
| WhatsApp/Baileys | Sistema externo | Transportar mensajes y mantener el canal WebSocket. |
| Motor `motor-decision` | Componente externo/local | Evaluar nodos, respuestas y transiciones del flujo. |
| Redis | Servicio de infraestructura | Persistir sesiones o credenciales en entornos locales. |
| Google Cloud Firestore | Servicio externo | Persistir credenciales de sesión en producción. |
| Google Sheets | Servicio externo | Persistir leads en hojas de contactos y lista de espera. |
| Sistema de archivos | Recurso local | Almacenar flujos, CSV, logs, credenciales y respaldos. |
| GCP Cloud Logging | Servicio externo | Recibir logs cuando se configura el adaptador GCP. |
| Docker/Compose | Plataforma de ejecución | Crear servicios, redes y volúmenes reproducibles. |
| GitHub Actions | Servicio de automatización | Ejecutar validaciones y despliegue automatizado. |

## Límites

Los usuarios humanos y servicios externos están fuera del límite de la aplicación. La aplicación incluye la configuración, los casos de uso, el dominio, la gestión de sesiones, los adaptadores y el servidor administrativo descritos en [arquitectura](../02-elaboracion/arquitectura.md).
