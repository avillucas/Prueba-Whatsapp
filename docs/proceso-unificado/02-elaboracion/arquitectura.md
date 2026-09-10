# Arquitectura y decisiones

## Estilo arquitectónico

El sistema aplica una arquitectura hexagonal organizada en dominio, aplicación e infraestructura:

- `src/domain/`: entidades, contratos y validadores independientes de la tecnología.
- `src/application/`: coordinación de sesiones, leads y árboles de decisión.
- `src/infrastructure/`: adaptadores de WhatsApp, CLI, almacenamiento, logging y servidor web.
- `src/config/`: configuración centralizada y selección de adaptadores.

## Componentes principales

| Componente | Responsabilidad | Artefacto de referencia |
|---|---|---|
| `DecisionTreeManager` | Carga, registra, actualiza y sincroniza flujos. | [`src/application/DecisionTreeManager.ts`](../../../src/application/DecisionTreeManager.ts) |
| `DecisionEngine` | Evalúa respuestas y avanza entre nodos. | Dependencia local `motorDecision/` |
| `SessionLeadManager` | Mantiene datos de sesión, valida y construye leads. | [`src/application/SessionLeadManager.ts`](../../../src/application/SessionLeadManager.ts) |
| `WhatsAppAdapter` | Conecta Baileys, sesiones, flujo y persistencia. | [`src/infrastructure/adapters/WhatsAppAdapter.ts`](../../../src/infrastructure/adapters/WhatsAppAdapter.ts) |
| `ConsoleAdapter` | Ejecuta el flujo mediante CLI. | [`src/infrastructure/adapters/ConsoleAdapter.ts`](../../../src/infrastructure/adapters/ConsoleAdapter.ts) |
| `AdminServer` | Protege y expone operaciones administrativas. | [`src/infrastructure/web/AdminServer.ts`](../../../src/infrastructure/web/AdminServer.ts) |
| Repositorios de leads | Persisten CSV, Google Sheets o composición de ambos. | [`src/infrastructure/repositories/`](../../../src/infrastructure/repositories/) |
| Adaptadores de autenticación | Persisten credenciales en archivo, Redis o Firestore. | [`src/infrastructure/adapters/auth/`](../../../src/infrastructure/adapters/auth/) |
| Logging | Centraliza errores y eventos de operación. | [`src/infrastructure/logging/`](../../../src/infrastructure/logging/) |

## Decisiones técnicas

1. Los flujos son datos externos al código y se cargan desde `flows/`.
2. Redis puede actuar como repositorio de flujos y como almacenamiento de autenticación según la configuración.
3. Firestore se reserva para persistencia de credenciales en escenarios de producción.
4. Los leads se abstraen mediante `LeadRepository` para permitir CSV, Google Sheets o composición.
5. Los adaptadores se seleccionan por configuración y factorías.
6. Docker Compose separa los perfiles de ejecución y conserva volúmenes persistentes.
7. El panel administrativo requiere autenticación y permite operación remota del bot.

## Diagramas actuales y brechas

- Contexto: [`context.puml`](../../../diagrams/context.puml)
- Clases: [`class.puml`](../../../diagrams/class.puml)
- Comunicación: [`communication.puml`](../../../diagrams/communication.puml)
- Componentes: [`component.puml`](../../../diagrams/component.puml)

Los diagramas existentes deben actualizarse para mostrar `AdminServer`, `DecisionTreeManager`, `FlowRepository`, el panel web y GitHub Actions. El diagrama de casos de uso y el de despliegue se incorporan como nuevos artefactos de Elaboración.
