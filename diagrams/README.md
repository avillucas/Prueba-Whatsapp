# Diagramas UML del Proyecto WhatsApp Bot

Este directorio contiene la documentación gráfica oficial del proyecto expresada en archivos `.puml` (PlantUML):

| Archivo | Diagrama | Descripción |
| :--- | :--- | :--- |
| [`context.puml`](./context.puml) | **Diagrama de Contexto** | Define los actores (WhatsApp/CLI), los límites del sistema y las integraciones externas (Redis, Firestore, Google Sheets, Plantillas). |
| [`class.puml`](./class.puml) | **Diagrama de Clases** | Modela las clases, entidades, factorías y adaptadores según la Arquitectura Hexagonal. |
| [`communication.puml`](./communication.puml) | **Diagrama de Comunicaciones** | Muestra el intercambio secuencial de mensajes entre objetos para el procesamiento de mensajes y la captura de leads. |
| [`component.puml`](./component.puml) | **Diagrama de Componentes** | Representa los puertos/adaptadores, la infraestructura de contenedores Docker y el montaje de volúmenes persistentes. |

## 🛠️ Cómo Renderizar los Diagramas
Puedes previsualizar o exportar estos archivos utilizando:
- **VSCode**: Extensión *PlantUML* (`jebbs.plantuml`). Presiona `Alt + D` para previsualizar.
- **CLI PlantUML**: `plantuml diagrams/*.puml`
- **Editor en línea**: Copiando el contenido en [PlantText](https://www.planttext.com/) o [PlantUML Web Server](www.plantuml.com/plantuml/uml/).
