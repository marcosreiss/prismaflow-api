# ==============================
# 🔹 Etapa 1: Build da aplicação
# ==============================
FROM node:20-alpine AS build

WORKDIR /app

# Copia dependências e instala
COPY package*.json ./
RUN npm install

# Copia o restante do código
COPY . .

# Gera Prisma Client antes do build
RUN npx prisma generate

# Compila o TypeScript
RUN npm run build

# ==============================
# 🔹 Etapa 2: Execução da aplicação
# ==============================
FROM node:20-alpine

WORKDIR /app

# Copia apenas o que é necessário para rodar
COPY package*.json ./
RUN npm install --omit=dev

# Copia o build (dist) e schema do prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Expõe a porta
EXPOSE 3000

ENV NODE_ENV=production

# Executa o servidor
CMD ["node", "dist/server.js"]
