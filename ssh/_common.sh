#!/bin/bash
set -e

# Determinar el directorio raíz del proyecto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. Asegurar la existencia de los directorios requeridos por los volúmenes
ensure_volumes() {
    mkdir -p auth_info data flows logs
}

# 2. Sincronizar la librería local motorDecision si está presente en la carpeta hermana
sync_motor_decision() {
    if [ -d "../motorDecision" ]; then
        echo "🔄 Sincronizando la librería motorDecision desde ../motorDecision..."
        mkdir -p motorDecision/dist
        if [ -d "../motorDecision/dist" ]; then
            cp -r ../motorDecision/dist/* motorDecision/dist/ 2>/dev/null || true
        fi
        if [ -f "../motorDecision/package.json" ]; then
            cp ../motorDecision/package.json motorDecision/package.json 2>/dev/null || true
        fi
    fi
}

# 3. Inicialización común completa
init_infrastructure() {
    ensure_volumes
    sync_motor_decision
}
