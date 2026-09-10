# Modelo de casos de uso

## UC-01 Atender consulta por WhatsApp

**Actor principal:** Usuario final de WhatsApp.

**Precondiciones:** El bot está conectado y existe un flujo registrado.

**Flujo principal:**

1. El usuario envía un mensaje.
2. Baileys entrega el evento al adaptador de WhatsApp.
3. El sistema identifica o crea la sesión.
4. El motor obtiene el nodo actual.
5. El sistema evalúa la respuesta y selecciona la transición.
6. El bot envía el texto del siguiente nodo.
7. El sistema conserva el estado de la sesión.

**Alternativas:** Una respuesta inválida utiliza la transición comodín definida por el nodo. Un error de infraestructura se registra mediante `ErrorHandler`.

## UC-02 Capturar datos para lista de espera

**Actor principal:** Usuario final de WhatsApp.

**Flujo principal:** El usuario selecciona la opción de lista de espera, informa nombre, teléfono, correo y curso de interés. El sistema valida los datos, confirma el registro y guarda el lead al finalizar la sesión.

**Resultado:** Lead persistido en el repositorio configurado como lista de espera.

## UC-03 Registrar consulta personalizada

**Actor principal:** Usuario final de WhatsApp.

**Flujo principal:** El usuario selecciona la consulta personalizada, informa sus datos de contacto y escribe su consulta. El sistema valida, registra y confirma la recepción.

**Resultado:** Lead persistido como contacto con consulta personalizada.

## UC-04 Operar el bot mediante CLI

**Actor principal:** Operador CLI.

**Flujo principal:** El operador inicia el perfil de consola, interactúa con el flujo y verifica la captura de datos sin depender de WhatsApp.

## UC-05 Administrar conexión de WhatsApp

**Actor principal:** Administrador del sistema.

**Flujo principal:** El administrador accede al panel protegido, observa el estado, escanea el QR o solicita el reseteo de la cuenta. El sistema limpia credenciales, reinicia la conexión y publica un nuevo estado.

## UC-06 Administrar flujos

**Actor principal:** Administrador del sistema.

**Flujo principal:** El administrador lista, consulta, registra o actualiza un flujo. El sistema valida que el contenido sea un arreglo de nodos, lo registra en memoria, lo persiste localmente y, si está habilitado, lo sincroniza con Redis.

**Riesgo:** La API actual comprueba que exista un arreglo, pero la validación semántica de IDs y transiciones debe mantenerse como requisito de calidad del flujo.

## UC-07 Persistir y observar la operación

**Actores secundarios:** CSV, Google Sheets, Redis, Firestore, sistema de archivos y GCP Cloud Logging.

El sistema elige adaptadores mediante configuración, guarda leads y credenciales, y registra eventos o errores según el entorno.

## Relaciones con artefactos

- UC-01 y UC-02: [árbol de decisión CFP 412](../../arbol_decision_cfp412.md).
- UC-06: [`DecisionTreeManager`](../../../src/application/DecisionTreeManager.ts) y `AdminServer`.
- UC-07: repositorios y adaptadores de [`src/infrastructure/`](../../../src/infrastructure/).
- Verificación: [`src/tests/`](../../../src/tests/).
