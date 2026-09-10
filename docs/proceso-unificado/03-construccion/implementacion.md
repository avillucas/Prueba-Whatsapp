# Implementación y configuración

## Organización del código

- Dominio: contratos de leads, autenticación, logging y repositorios.
- Aplicación: gestión de sesiones, leads y árboles de decisión.
- Infraestructura: adaptadores de WhatsApp/CLI, repositorios, autenticación, logging y panel web.
- Configuración: `src/config/config.ts` y `src/config/config.json`.

## Artefactos implementados

| Artefacto | Propósito |
|---|---|
| `flows/flow_cfp412.json` | Flujo conversacional predeterminado. |
| `DecisionTreeManager` | Registro, carga, persistencia y sincronización de flujos. |
| `RedisFlowRepository` | Persistencia de flujos en Redis. |
| `AdminServer` | Consulta y actualización de flujos y operación administrativa. |
| `SessionLeadManager` | Estado de sesión y construcción de leads. |
| Factorías | Selección de repositorios, autenticación y logging. |
| Docker Compose | Perfiles de CLI, WhatsApp, Redis, pruebas y despliegue. |

## Convención para nuevos flujos

1. Crear un archivo JSON dentro de `flows/`.
2. Usar IDs únicos y un nodo inicial definido.
3. Comprobar que cada `nextId` exista.
4. Mantener preguntas abiertas con `extractData` y transición comodín cuando corresponda.
5. Probar el flujo desde CLI o mediante las pruebas del motor.
6. Documentar el caso de uso y actualizar el índice de artefactos.

El prompt reutilizable está en [prompt_flows.md](../../prompt_flows.md).

## Configuración por entorno

Los valores de `INTERFACE`, almacenamiento de leads, autenticación, logging, panel web y servicios externos se describen en el [README técnico](../../../README.md) y en las [guías de entornos](../../entornos/README.md).
