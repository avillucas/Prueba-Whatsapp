# Glosario

| Término | Definición |
|---|---|
| Árbol de decisión | Conjunto de nodos JSON que determina el recorrido de una conversación. |
| Nodo | Unidad de un flujo que contiene un mensaje, datos opcionales y transiciones. |
| Transición | Regla `match` y `nextId` que determina el siguiente nodo. |
| Comodín `*` | Regla que coincide con cualquier respuesta del usuario. |
| Flujo | Archivo o conjunto de nodos identificado por un `flowId`. |
| `MSG_INICIAL` | Nodo inicial predeterminado de los flujos. |
| `MSG_CIERRE` | Nodo de cierre que permite volver al menú principal. |
| `extractData` | Campo que indica el nombre de la variable donde se guarda la respuesta. |
| Lead | Registro de datos de una persona interesada o que realizó una consulta. |
| Lista de espera | Registro de personas interesadas en recibir una vacante o información de un curso. |
| Sesión | Estado temporal de una conversación y sus datos capturados. |
| Adaptador | Implementación de infraestructura que conecta la aplicación con un servicio externo. |
| Puerto | Contrato del dominio o la aplicación que define una capacidad sin acoplarla a una tecnología. |
| Baileys | Librería utilizada para conectar el bot con WhatsApp Web mediante WebSocket. |
| Redis | Base de datos en memoria utilizada para sesiones o credenciales locales. |
| Firestore | Base de datos NoSQL de Google Cloud utilizada para persistencia en producción. |
| GCP | Google Cloud Platform. |
| RUP/UP | Proceso Unificado de desarrollo iterativo e incremental. |
| CLI | Interfaz de línea de comandos utilizada para ejecutar el bot en modo consola. |
| Hot-reload | Actualización de un flujo en memoria y persistencia sin reiniciar necesariamente la aplicación. |
| Perfil Docker | Configuración de Compose que selecciona un entorno de ejecución. |
| LeadRepository | Contrato para guardar y consultar leads. |
| FlowRepository | Contrato para guardar, consultar, listar o eliminar flujos. |
| `flow_cfp412` | Flujo predeterminado actual del Centro de Formación Profesional N.° 412. |
