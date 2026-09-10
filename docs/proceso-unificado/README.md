# Documentación del Proceso Unificado

Este directorio organiza la documentación del bot de WhatsApp según las fases y artefactos del Proceso Unificado (UP/RUP).

## Fases y artefactos

| Fase | Objetivo | Artefactos principales |
|---|---|---|
| [Inicio](./01-inicio/README.md) | Definir visión, alcance, actores y riesgos iniciales. | Visión, alcance, actores, glosario, riesgos. |
| [Elaboración](./02-elaboracion/README.md) | Precisar requisitos y establecer la arquitectura. | Casos de uso, requisitos suplementarios, arquitectura y trazabilidad. |
| [Construcción](./03-construccion/README.md) | Implementar, integrar y verificar la solución. | Implementación, configuración, pruebas y matriz de cobertura. |
| [Transición](./04-transicion/README.md) | Operar y desplegar el producto en sus entornos objetivo. | Despliegue, operación, soporte y notas de versión. |

## Índice de artefactos

El inventario completo está en [índice de artefactos](./00-indice-artefactos.md).

## Fuentes existentes

- [Diagramas UML](../../diagrams/README.md)
- [Árbol de decisión CFP 412](../arbol_decision_cfp412.md)
- [Prompt para generar flujos](../prompt_flows.md)
- [Guías de entornos](../entornos/README.md)
- [README técnico del proyecto](../../README.md)
- [Guía para agentes](../../agent.md)

## Criterio de mantenimiento

Cada cambio funcional debe actualizar, cuando corresponda, el caso de uso afectado, el flujo JSON, el diagrama relacionado, las pruebas y la guía del entorno donde se ejecuta.
