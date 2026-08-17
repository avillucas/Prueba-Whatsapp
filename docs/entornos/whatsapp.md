# Entorno WhatsApp Local con Redis (`./ssh/whatsapp`)

Este documento detalla la configuración, credenciales y variables de entorno necesarias para ejecutar el bot de WhatsApp real en entorno de desarrollo local con persistencia de sesión en **Redis** mediante el comando `./ssh/whatsapp`.

---

## 🎯 Descripción del Entorno

Este entorno levanta el bot conectado a la red real de WhatsApp utilizando la librería `@whiskeysockets/baileys`. 
Para evitar guardar el estado de la sesión en disco local plano dentro del contenedor Docker (lo cual causa desconexiones al reiniciar), la sesión NoSQL de WhatsApp se persiste en una base de datos **Redis** mediante `RedisAuthAdapter`.

- **Comando de ejecución**: `./ssh/whatsapp`
- **Servicios Docker Compose**: `redis` (`whatsapp-redis`) + `whatsapp-local` (`whatsapp-service`)
- **Almacenamiento de Sesión**: Redis NoSQL local
- **Almacenamiento de Leads**: CSV local (`./data/leads.csv`)

---

## ⚙️ Variables de Entorno

| Variable | Valor por Defecto | Obligatorio | Descripción |
| :--- | :--- | :--- | :--- |
| `INTERFACE` | `baileys` | Sí | Habilita la conexión real con el motor de WhatsApp Web (Baileys). |
| `FLOW_FILE` | `flow_cfp412.json` | Sí | Archivo del árbol de decisiones conversacional. |
| `LEADS_STORAGE_TYPE` | `csv` | Sí | Almacena los leads en `./data/leads.csv`. |
| `AUTH_STORAGE_TYPE` | `redis` | Sí | Adaptador NoSQL para la sesión de WhatsApp en Redis. |
| `REDIS_HOST` | `redis` | Sí | Nombre del servicio host de Redis en la red Docker. |
| `REDIS_PORT` | `6379` | Sí | Puerto de la instancia de Redis. |
| `REDIS_PASSWORD` | *vacío* | No | Contraseña de autenticación de Redis (si aplica). |
| `LOG_DIR` | `./logs` | No | Ruta para archivos de log. |

---

## 🔑 Credenciales y Código QR de WhatsApp

### ¿Qué credenciales requiere?
1. **Credenciales de Sesión de WhatsApp**: No se crean manualmente en archivos. Se obtienen escaneando un **Código QR ASCII** proyectado en la terminal con la aplicación de WhatsApp de un dispositivo móvil.
2. **Servicio Redis**: Es autogestionado por Docker Compose mediante la imagen `redis:7-alpine`.

---

## 📲 Paso a Paso para Conectar el Bot

1. Asegúrate de tener el entorno preparado con tu archivo `.env`:
   ```env
   INTERFACE=baileys
   FLOW_FILE=flow_cfp412.json
   LEADS_STORAGE_TYPE=csv
   AUTH_STORAGE_TYPE=redis
   REDIS_HOST=redis
   REDIS_PORT=6379
   ```

2. Ejecuta el comando SSH de inicio:
   ```bash
   ./ssh/whatsapp
   ```

3. El script levantará el contenedor de Redis y construirá la aplicación. En la consola se imprimirá un código QR en formato ASCII.

4. Abre la aplicación de **WhatsApp** en tu teléfono móvil:
   - En Android: Toca los tres puntos en la esquina superior derecha > **Dispositivos vinculados**.
   - En iOS: Ve a **Configuración** > **Dispositivos vinculados**.
   - Presiona **Vincular un dispositivo** y escanea el código QR proyectado en la pantalla.

5. Una vez escaneado, verás en la consola:
   ```text
   ¡Bot de WhatsApp conectado y listo para recibir mensajes!
   ```

6. La sesión quedará guardada de forma persistente en el volumen nombrado `redis_data` de Docker. Si reinicias el contenedor, no necesitarás volver a escanear el QR.
