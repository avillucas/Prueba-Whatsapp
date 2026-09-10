# Índice de artefactos

Este índice relaciona las fases del Proceso Unificado con la documentación existente y la documentación creada para ordenar el proyecto.

## Inicio

- [Visión y alcance](./01-inicio/vision-y-alcance.md)
- [Actores](./01-inicio/actores.md)
- [Glosario](./01-inicio/glosario.md)
- Riesgos iniciales: pendiente de formalizar en una matriz específica.

## Elaboración

- [Casos de uso](./02-elaboracion/casos-de-uso.md)
- [Arquitectura y decisiones](./02-elaboracion/arquitectura.md)
- [Requisitos suplementarios y trazabilidad](./02-elaboracion/requisitos-suplementarios.md)
- [Diagramas UML existentes](../../diagrams/README.md)
- [Árbol de decisión conversacional](../arbol_decision_cfp412.md)
- Diagrama de casos de uso: pendiente de agregar en `diagrams/use-cases.puml`.

## Construcción

- [Implementación y configuración](./03-construccion/implementacion.md)
- [Plan y evidencia de pruebas](./03-construccion/pruebas.md)
- Código fuente: [`src/`](../../src/)
- Flujos: [`flows/`](../../flows/)
- Librería del motor: [`motorDecision/`](../../motorDecision/)
- Cobertura generada: [`coverage/`](../../coverage/)

## Transición

- [Despliegue y operación](./04-transicion/despliegue.md)
- [Guías de entornos](../entornos/README.md)
- [Composición Docker](../../docker-compose.yml)
- Automatización SSH: [`ssh/`](../../ssh/)
- Notas de versión: pendiente de formalizar por release.

## Artefactos transversales

- Configuración: [`src/config/`](../../src/config/)
- Datos de ejemplo: [`data/`](../../data/)
- Logs de ejecución: [`logs/`](../../logs/)
- Credenciales de sesión: [`auth_info/`](../../auth_info/)
- Diagramas fuente: [`diagrams/`](../../diagrams/)

## Convención de actualización

Un cambio debe registrar al menos:

1. El requisito o caso de uso afectado.
2. El componente o flujo modificado.
3. Las pruebas ejecutadas.
4. El entorno impactado y su procedimiento de despliegue.
