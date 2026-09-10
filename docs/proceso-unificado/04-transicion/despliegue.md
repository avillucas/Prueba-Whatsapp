# Despliegue y operación

## Entornos soportados

| Entorno | Uso | Guía |
|---|---|---|
| CLI local | Pruebas manuales y operación por consola. | [cli.md](../../entornos/cli.md) |
| CLI Google Sheets | Pruebas de persistencia cloud de leads. | [cli-googlesheet.md](../../entornos/cli-googlesheet.md) |
| WhatsApp Redis | Operación local con Redis. | [whatsapp.md](../../entornos/whatsapp.md) |
| WhatsApp Firestore | Producción con sesión en Firestore y leads en Sheets. | [whatsapp-firestore.md](../../entornos/whatsapp-firestore.md) |
| WhatsApp Storage | Selección configurable de almacenamiento. | [whatsapp-storage.md](../../entornos/whatsapp-storage.md) |
| Test/Lint | Verificación aislada en Docker. | [test.md](../../entornos/test.md) y [lint.md](../../entornos/lint.md) |

## Procedimiento de entrega

1. Ejecutar `./ssh/test`.
2. Ejecutar `./ssh/lint`.
3. Revisar variables y secretos del entorno.
4. Construir y levantar el perfil requerido con Docker Compose.
5. Verificar logs, conexión de WhatsApp, persistencia y flujo principal.
6. Para producción, ejecutar `./ssh/deploy` y revisar la conectividad SSH previa.

## Persistencia y seguridad

- No versionar secretos, claves privadas ni credenciales de WhatsApp.
- Conservar `auth_info/`, `data/`, `logs/` y `flows/` mediante los volúmenes definidos.
- Usar Redis en desarrollo y Firestore cuando el entorno de producción lo requiera.
- Proteger el panel con `ADMIN_PASSWORD` y no utilizar la contraseña predeterminada en producción.

## Operación posterior

- Revisar logs locales o GCP Cloud Logging.
- Confirmar que los leads llegan al repositorio configurado.
- Comprobar que el flujo activo coincide con el `defaultFlowId` esperado.
- Ante un cambio de cuenta, utilizar el reseteo del panel y volver a escanear el QR.
