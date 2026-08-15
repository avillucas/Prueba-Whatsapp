# Etapa de construcción
FROM node:20-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

# 1. Copiamos o clonamos la librería motorDecision desde GitHub si no existe
COPY motorDecision* ./motorDecision/
RUN if [ ! -f ./motorDecision/package.json ]; then \
      echo "Clonando motorDecision desde GitHub..." && \
      git clone https://github.com/avillucas/motorDecision.git ./motorDecision ; \
    fi && \
    if [ ! -d ./motorDecision/dist ]; then \
      echo "Compilando motorDecision..." && \
      cd ./motorDecision && npm install && npm run build ; \
    fi


# 2. Copiamos los archivos de configuración y dependencias de la app principal
COPY package.json tsconfig.json jest.config.js ./

# 3. Instalamos dependencias de la app principal
RUN npm install

# 4. Copiamos el código fuente de la app principal
COPY src ./src

# 5. Compilamos TypeScript a JavaScript
RUN npm run build

# Etapa de producción
FROM node:20-alpine AS runner

RUN apk add --no-cache git

WORKDIR /app

# Copiamos motorDecision desde la etapa de construcción
COPY --from=builder /app/motorDecision ./motorDecision

# Copiamos package.json
COPY package.json ./

# Instalamos dependencias de producción
RUN npm install --omit=dev

# Copiamos los archivos compilados desde la etapa de construcción
COPY --from=builder /app/dist ./dist

# Copiamos archivos de configuración y flujos
COPY src/config/config.json ./src/config/config.json
COPY flows ./flows

# Comando para iniciar la aplicación
CMD ["npm", "start"]
