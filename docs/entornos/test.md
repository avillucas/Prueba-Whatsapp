# Entorno de Pruebas Unitarias (`./ssh/test`)

Este documento detalla la configuración, credenciales y ejecución de la suite de pruebas unitarias e integración en el entorno aislado Docker mediante el comando `./ssh/test`.

---

## 🎯 Descripción del Entorno

El entorno **Test** permite ejecutar la suite completa de pruebas automáticas escritas en **Jest** dentro de un contenedor Docker aislado (`builder` stage). 
Esto garantiza que los tests corran de manera idéntica independientemente del sistema operativo o entorno local del desarrollador.

- **Comando de ejecución**: `./ssh/test`
- **Servicio / Perfil Docker**: `test` (Perfil Compose: `test`)
- **Contenedor resultante**: `whatsapp-bot-test`
- **Framework de Testing**: Jest

---

## ⚙️ Variables de Entorno y Mocks

Este entorno se ejecuta en un ambiente puramente hermético y aislado.
- **Mocks de Integración**: Todos los adaptadores de infraestructura (Firestore, Redis, Google Sheets, Baileys) son simulados mediante Mocks/Stubs de Jest en `src/tests/`.
- No requiere conectividad con base de datos real ni servicios en la nube para ejecutar los unit tests.

---

## 🔑 Credenciales y Requisitos de Acceso

### ¿Requiere credenciales externas?
**No.** No se requiere ninguna clave de GCP, Google Sheets ni sesión de WhatsApp.

---

## 🚀 Formas de Ejecución

### 1. Ejecutar toda la suite de pruebas
```bash
./ssh/test
```

### 2. Ejecutar un archivo de test específico
```bash
./ssh/test -- src/tests/WhatsAppAdapter.test.ts
```

### 3. Ejecutar Jest en modo de observación (*watch mode*)
```bash
./ssh/test -- --watch
```
