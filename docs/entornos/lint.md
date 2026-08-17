# Entorno de Verificación y Calidad (`./ssh/lint`)

Este documento detalla la comprobación estática de tipos y calidad de código mediante **ESLint** y **TypeScript Compiler** en Docker con el comando `./ssh/lint`.

---

## 🎯 Descripción del Entorno

El entorno **Lint** realiza las verificaciones estáticas de calidad de código:
1. **Comprobación de Tipos de TypeScript**: Ejecuta `tsc --noEmit` para asegurar que no haya errores de tipado en todo el proyecto.
2. **Linter con ESLint**: Ejecuta `eslint` para verificar las reglas de estilo, buenas prácticas y prevención de bugs.

- **Comando de ejecución**: `./ssh/lint`
- **Servicio / Perfil Docker**: `test` (Perfil Compose: `test`)
- **Herramientas**: `tsc` (TypeScript) + `eslint`

---

## ⚙️ Variables de Entorno y Credenciales

- **No requiere variables de entorno ni credenciales externas**.
- Se ejecuta sobre el código fuente montado en el contenedor Docker.

---

## 🚀 Ejecución del Linter

Para verificar la calidad del código antes de un commit o despliegue:

```bash
./ssh/lint
```

Si se detectan advertencias o errores de tipado o formato, la consola mostrará la línea y archivo correspondiente para su corrección.
