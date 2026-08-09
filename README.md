# Minimalist WhatsApp Bot con TypeScript y Docker

Este es un bot minimalista para WhatsApp que responde "Hola Mundo!!!" a cualquier mensaje de texto recibido.
Utiliza `@whiskeysockets/baileys` para la conexión y está empaquetado con Docker para su fácil despliegue.

## Requisitos previos

- Docker
- Docker Compose

## Cómo iniciar el proyecto

1. En la raíz del proyecto, ejecuta el siguiente comando para construir y levantar el contenedor:
   ```bash
   docker compose up --build
   ```

2. En los logs de la consola aparecerá un código QR. Abre WhatsApp en tu teléfono, ve a **Dispositivos Vinculados** y escanea el QR.
3. Una vez vinculado, verás el mensaje `¡Conectado exitosamente a WhatsApp!` en la consola.
4. Si quieres dejar el bot corriendo en segundo plano y salir de la vista de logs de Docker, puedes presionar `Ctrl + C` o haberlo iniciado con `docker compose up -d` (aunque para la primera vinculación necesitas ver los logs).
5. Para ver los logs nuevamente puedes usar:
   ```bash
   docker compose logs -f
   ```

## Estructura y Sesión
- La sesión de vinculación persistirá en la carpeta local `./auth_info` (la cual se montará como volumen y se creará automáticamente la primera vez). 
- Gracias a esto, no tendrás que escanear el QR cada vez que reinicias el bot o el contenedor.
