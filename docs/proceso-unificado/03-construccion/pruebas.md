# Plan y evidencia de pruebas

## Estrategia

| Nivel | Alcance | Ubicación |
|---|---|---|
| Unitario | Validadores, configuración, adaptadores y servicios de aplicación. | `src/tests/` |
| Integración | Flujo, repositorios, almacenamiento y servidor administrativo. | `src/tests/` |
| Flujo conversacional | Recorridos CFP 412, captura de leads y cierre. | `src/tests/cfp412.test.ts` y pruebas de aplicación |
| Estático | Tipos TypeScript y reglas de lint. | `./ssh/lint` |
| Cobertura | Medición de código ejecutado por Jest. | `coverage/` |

## Criterios de aceptación

- Cada caso de uso crítico tiene al menos una prueba automatizada.
- Las respuestas inválidas siguen la transición comodín definida.
- Los datos de leads se validan antes de persistirse.
- El flujo puede cargarse desde disco y, cuando corresponde, desde Redis.
- El panel rechaza solicitudes no autenticadas.
- Los adaptadores configurados se crean correctamente.
- La suite de Jest, TypeScript y ESLint finaliza sin errores en Docker.

## Ejecución estándar

```bash
./ssh/test
./ssh/lint
```

Los resultados deben registrarse en el cambio correspondiente y, si se modifica un flujo, incluir el recorrido funcional verificado.
