# Prompt para generar flujos de decisión

Copia y utiliza el siguiente prompt para generar nuevos flujos compatibles con este proyecto:

```text
Actúa como diseñador de flujos conversacionales para un bot de WhatsApp.

Tu tarea es generar un flujo de decisión completo en formato JSON, compatible con el motor `motor-decision`.

## Formato obligatorio

La respuesta debe ser únicamente un arreglo JSON válido de nodos:

[
  {
    "id": "IDENTIFICADOR_UNICO",
    "text": "Mensaje que recibirá el usuario",
    "extractData": "NombreDeLaVariable",
    "options": [
      {
        "match": "RESPUESTA_ESPERADA",
        "nextId": "ID_DEL_SIGUIENTE_NODO"
      }
    ]
  }
]

## Reglas de los nodos

Cada nodo puede contener:

- `id`: identificador único del nodo.
- `text`: mensaje enviado al usuario.
- `extractData`: opcional. Indica que la respuesta del usuario debe guardarse con ese nombre.
- `options`: arreglo de transiciones hacia otros nodos.

El campo `extractData` debe utilizarse cuando el nodo solicita información, por ejemplo:

- `Nombre_y_Apellido`
- `Telefono_WhatsApp`
- `Correo_Electronico`
- `Curso_Interes`
- `Consulta_Personalizada`

## Reglas de las transiciones

Cada opción debe tener:

- `match`: respuesta que activa la transición.
- `nextId`: identificador exacto del nodo siguiente.

Reglas especiales:

1. El primer nodo debe tener el ID indicado por `initialNodeId`. Si no se especifica otro, utilizar `MSG_INICIAL`.
2. Todas las opciones deben apuntar a un `nextId` existente.
3. Todos los IDs deben ser únicos.
4. Las respuestas se comparan ignorando mayúsculas, minúsculas y espacios laterales.
5. El valor `"*"` funciona como comodín y coincide con cualquier respuesta.
6. En preguntas abiertas, utilizar `"match": "*"` para guardar la respuesta y avanzar.
7. En menús, utilizar opciones específicas como `"A"`, `"B"` o `"C"` y agregar una opción `"*"` para respuestas inválidas.
8. Las opciones específicas deben aparecer antes que la opción comodín `"*"`.
9. No crear nodos aislados o inalcanzables.
10. Se permiten ciclos controlados, por ejemplo un nodo de cierre que vuelva al menú principal.
11. Un nodo final puede tener `"options": []`, aunque se recomienda enviar los flujos terminados a un nodo común de cierre.

## Reglas conversacionales

- El flujo debe comenzar con un menú principal claro.
- Cada opción del menú debe llevar a un recorrido coherente.
- Las preguntas que recopilan datos deben realizarse una por una.
- Después de recopilar datos, debe existir un nodo de confirmación.
- Incluir un nodo de cierre común con una opción para volver al menú principal.
- Los textos deben estar redactados en español claro y natural.
- No solicitar datos que no sean necesarios para el objetivo del flujo.
- No inventar enlaces, fechas o datos institucionales. Utilizar únicamente la información proporcionada.
- Se pueden usar variables en los textos con el formato `{{NombreDeLaVariable}}`.

## Requisitos antes de responder

Verifica que:

- El resultado sea JSON válido.
- El resultado no tenga comentarios, explicaciones ni bloques Markdown.
- El arreglo contenga al menos un nodo inicial.
- No existan IDs duplicados.
- Todas las transiciones apunten a nodos existentes.
- El flujo sea navegable desde el nodo inicial.
- Cada pregunta con `extractData` tenga una transición posterior.
- Las opciones con comodín estén ubicadas al final del arreglo `options`.

## Datos para generar el flujo

Nombre del flujo: [INDICAR NOMBRE]

Objetivo: [DESCRIBIR OBJETIVO]

Nodo inicial: [INDICAR ID O USAR MSG_INICIAL]

Opciones principales:
[LISTAR OPCIONES]

Información que se debe recopilar:
[LISTAR DATOS]

Mensajes, respuestas, enlaces y reglas específicas:
[DETALLAR INFORMACIÓN]

Genera ahora únicamente el arreglo JSON final.
```

## Notas de compatibilidad

- Los flujos del proyecto se almacenan como archivos `.json` dentro de la carpeta `flows/`.
- El nodo inicial predeterminado es `MSG_INICIAL`.
- Las transiciones utilizan `nextId`.
- Las respuestas abiertas normalmente utilizan `match: "*"`.
- Las variables pueden interpolarse en los textos con el formato `{{NombreDeLaVariable}}`.
