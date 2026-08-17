# Entorno WhatsApp Storage (`./ssh/whatsapp-storage`)

Este documento detalla la configuración, credenciales y variables de entorno necesarias para ejecutar el bot de WhatsApp con backend de almacenamiento NoSQL híbrido/configurable mediante el comando `./ssh/whatsapp-storage`.

---

## 🎯 Descripción del Entorno

El entorno **WhatsApp Storage** se utiliza para probar y validar adaptadores de almacenamiento de sesión NoSQL personalizados (por ejemplo, con mutaciones dinámicas entre Redis y Firestore, o pruebas de migración de estado de sesión).

- **Comando de ejecución**: `./ssh/whatsapp-storage`
- **Servicios Docker Compose**: `redis` (`whatsapp-redis`) + `whatsapp-local` (contenedor interactivo `--name whatsapp-storage`)
- **Almacenamiento de Sesión**: Configurable dinámicamente (`AUTH_STORAGE_TYPE` = `firestore` | `redis`)

---

## ⚙️ Variables de Entorno

| Variable | Valor por Defecto | Obligatorio | Descripción |
| :--- | :--- | :--- | :--- |
| `INTERFACE` | `baileys` | Sí | Habilita el adaptador de WhatsApp Web (Baileys). |
| `FLOW_FILE` | `flow_cfp412.json` | Sí | Archivo del flujo conversacional. |
| `AUTH_STORAGE_TYPE` | `firestore` | Sí | Adaptador NoSQL a probar (`firestore` o `redis`). |
| `REDIS_HOST` | `redis` | No | Host del servicio Redis en la red Docker. |
| `REDIS_PORT` | `6379` | No | Puerto de Redis. |
| `GCP_PROJECT_ID` | *Definido en `.env`* | Si se usa Firestore | ID del proyecto GCP. |
| `DATABASE` / `FIRESTORE_DATABASE_ID` | *Definido en `.env`* | Si se usa Firestore | ID de la base de datos Firestore. |
| `FIRESTORE_COLLECTION_NAME` | `whatsapp_auth` | Si se usa Firestore | Colección de autenticación. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | *Definido en `.env`* | Si se usa Firestore | Email de Service Account. |
| `GOOGLE_PRIVATE_KEY` | *Definido en `.env`* | Si se usa Firestore | Clave privada RSA. |

---

## 🔑 Credenciales y Requisitos de Acceso

Dependiendo de la estrategia seleccionada en `AUTH_STORAGE_TYPE`:

### Modo Firestore (`AUTH_STORAGE_TYPE=firestore`)
- Requiere cuenta de servicio GCP configurada con rol `Cloud Datastore User` y base de datos Firestore activa.
- Consulta los pasos detallados en [docs/entornos/whatsapp-firestore.md](./whatsapp-firestore.md).

### Modo Redis (`AUTH_STORAGE_TYPE=redis`)
- Utiliza la instancia local de Redis instanciada por Docker Compose.
- Consulta los pasos detallados en [docs/entornos/whatsapp.md](./whatsapp.md).

---

## 🚀 Ejecución del Entorno

Para ejecutar este contenedor en modo interactivo (`-it`):

```bash
./ssh/whatsapp-storage
```

Puedes sobrescribir las variables al vuelo desde la terminal, por ejemplo para forzar Redis:

```bash
AUTH_STORAGE_TYPE=redis ./ssh/whatsapp-storage
```
