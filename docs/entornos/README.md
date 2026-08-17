# Índice de Entornos de Ejecución SSH (`./ssh/`)

Esta carpeta contiene la documentación detallada para cada uno de los entornos ejecutables disponibles a través de los scripts SSH en la carpeta `./ssh/`.

Cada guía explica el propósito del entorno, su matriz de variables de entorno, el procedimiento paso a paso para crear y acceder a las credenciales requeridas (Google Cloud, Firestore, Google Sheets, Redis, WhatsApp QR, SSH), y las instrucciones de ejecución.

---

## 📚 Documentación de Entornos

| Script SSH | Entorno | Descripción Principal | Documentación |
| :--- | :--- | :--- | :--- |
| **`./ssh/cli`** | CLI Local | Consola interactiva local con almacenamiento de leads en CSV. Sin credenciales externas. | [Ver Guía CLI](./cli.md) |
| **`./ssh/cli-googlesheet`** | CLI Google Sheets | Consola interactiva con exportación de leads directamente a Google Sheets via Service Account. | [Ver Guía CLI Google Sheets](./cli-googlesheet.md) |
| **`./ssh/whatsapp`** | WhatsApp Local (Redis) | Bot real conectado a WhatsApp (Baileys) con almacenamiento de sesión NoSQL en Redis local. | [Ver Guía WhatsApp Redis](./whatsapp.md) |
| **`./ssh/whatsapp-firebase`** | WhatsApp Firebase | Entorno completo de producción con sesión NoSQL en GCP Firestore y leads en Google Sheets. | [Ver Guía WhatsApp Firebase](./whatsapp-firebase.md) |
| **`./ssh/whatsapp-storage`** | WhatsApp Storage | Bot WhatsApp con backend de almacenamiento NoSQL híbrido y configurable. | [Ver Guía WhatsApp Storage](./whatsapp-storage.md) |
| **`./ssh/deploy`** | Despliegue Producción GCP | Script de compilación y levantamiento automatizado en segundo plano para servidores/VM GCP y GitHub Actions. | [Ver Guía Despliegue](./deploy.md) |
| **`./ssh/test`** | Suite de Tests (Jest) | Ejecución aislada de pruebas unitarias e integración en contenedor Docker. | [Ver Guía Tests](./test.md) |
| **`./ssh/lint`** | Linter & TypeScript Check | Verificación estática de tipos (`tsc`) y análisis de código (`eslint`) en Docker. | [Ver Guía Linter](./lint.md) |

---

## 🛠️ Requisitos Generales de Infraestructura

- **Docker y Docker Compose**: Instalados en el sistema anfitrión.
- **Archivo `.env`**: Creado a partir de `.env.example` en la raíz del proyecto.
- **Librería compartida `motorDecision`**: Se sincroniza automáticamente antes de cada comando mediante `ssh/_common.sh`.
