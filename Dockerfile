# Etapa de construcción
FROM node:20-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

# Copiamos motor-decision (necesario para la dependencia local file:../motorDecision)
COPY motorDecision /motorDecision

# Copiamos los archivos de dependencias
COPY ["Prueba Whatsapp/package.json", "Prueba Whatsapp/tsconfig.json", "./"]

# Instalamos dependencias
RUN npm install

# Copiamos el código fuente
COPY ["Prueba Whatsapp/src", "./src"]

# Compilamos TypeScript a JavaScript
RUN npm run build

# Etapa de producción
FROM node:20-alpine AS runner

RUN apk add --no-cache git

WORKDIR /app

# Copiamos motor-decision también en producción (npm install intentará leer file:../motorDecision)
COPY motorDecision /motorDecision

# Copiamos los archivos de dependencias
COPY ["Prueba Whatsapp/package.json", "./"]

# Instalamos dependencias
RUN npm install --omit=dev

# Copiamos los archivos compilados desde la etapa de construcción
COPY --from=builder /app/dist ./dist

# Copiamos los archivos JSON de configuración
COPY ["Prueba Whatsapp/src/config/config.json", "./src/config/config.json"]
COPY ["Prueba Whatsapp/flows/", "./flows/"]

# Comando para iniciar la aplicación
CMD ["npm", "start"]
