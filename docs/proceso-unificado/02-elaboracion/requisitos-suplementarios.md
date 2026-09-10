# Requisitos suplementarios y trazabilidad

## Requisitos funcionales

| ID | Requisito | Evidencia |
|---|---|---|
| RF-01 | El sistema debe recibir mensajes por WhatsApp y CLI. | `WhatsAppAdapter`, `ConsoleAdapter`, UC-01, UC-04 |
| RF-02 | El sistema debe navegar flujos JSON mediante nodos y transiciones. | `flows/`, `DecisionTreeManager`, prompt de flujos |
| RF-03 | El sistema debe extraer y validar datos de los usuarios. | `SessionLeadManager`, `LeadValidator`, UC-02, UC-03 |
| RF-04 | El sistema debe persistir leads en el repositorio configurado. | Repositorios de leads, UC-07 |
| RF-05 | El sistema debe persistir credenciales en el backend seleccionado. | Adaptadores de autenticación, UC-05 |
| RF-06 | El sistema debe registrar errores y eventos operativos. | `ErrorHandler`, adaptadores de logging |
| RF-07 | El sistema debe permitir administrar flujos desde el panel web. | `AdminServer`, UC-06 |
| RF-08 | El sistema debe sincronizar flujos con Redis cuando esté habilitado. | `FlowRepository`, `RedisFlowRepository` |

## Requisitos no funcionales

| ID | Requisito | Evidencia o criterio |
|---|---|---|
| RNF-01 | Configurabilidad | Adaptadores y valores seleccionables mediante configuración. |
| RNF-02 | Persistencia | Volúmenes Docker y backends externos conservan datos entre reinicios. |
| RNF-03 | Portabilidad | Ejecución reproducible con Docker Compose y scripts SSH. |
| RNF-04 | Mantenibilidad | Separación por dominio, aplicación e infraestructura. |
| RNF-05 | Observabilidad | Logs locales o GCP y manejo centralizado de errores. |
| RNF-06 | Seguridad | Panel protegido y credenciales fuera del código fuente. |
| RNF-07 | Verificabilidad | Pruebas Jest, cobertura, compilación TypeScript y lint. |

## Trazabilidad mínima

Un cambio en un requisito debe poder seguirse hasta uno o más de estos artefactos: caso de uso, flujo JSON, clase o adaptador, prueba, guía de entorno y diagrama afectado.
