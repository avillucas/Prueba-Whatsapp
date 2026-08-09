# Etapa de construcción
FROM node:20-alpine AS builder

WORKDIR /app

# Copiamos los archivos de dependencias
COPY package.json ./
COPY tsconfig.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el código fuente
COPY src ./src

# Compilamos TypeScript a JavaScript
RUN npm run build

# Etapa de producción
FROM node:20-alpine AS runner

WORKDIR /app

# Copiamos los archivos de dependencias
COPY package.json ./

# Instalamos dependencias (incluyendo devDependencies temporalmente para evitar problemas o usamos --omit=dev si están bien separadas)
# Aquí instalamos todo y luego limpiamos, o bien copiamos de builder node_modules.
# Para baileys y qrcode-terminal necesitamos todas las dependencies
RUN npm install --omit=dev

# Copiamos los archivos compilados desde la etapa de construcción
COPY --from=builder /app/dist ./dist

# Comando para iniciar la aplicación
CMD ["npm", "start"]
