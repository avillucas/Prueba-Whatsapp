# Etapa de construcción
FROM node:20-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

# Copiamos la librería motorDecision local si existe en el proyecto
COPY motorDecision ./motorDecision

# Copiamos los archivos de dependencias
COPY package.json tsconfig.json jest.config.js ./

# Instalamos dependencias (incluyendo devDependencies para compilar)
RUN npm install

# Copiamos el código fuente
COPY src ./src

# Compilamos TypeScript a JavaScript
RUN npm run build

# Etapa de producción
FROM node:20-alpine AS runner

RUN apk add --no-cache git

WORKDIR /app

# Copiamos la librería motorDecision local
COPY motorDecision ./motorDecision

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
