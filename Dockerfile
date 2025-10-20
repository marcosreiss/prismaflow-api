#########################################
# 🔹 Etapa 1: Build da aplicação
#########################################
FROM node:20-alpine AS build

WORKDIR /app

# Copia e instala dependências (com cache eficiente)
COPY package*.json ./
RUN npm ci

# Copia o restante do código-fonte
COPY . .

# Gera o Prisma Client antes do build (para tipos TS)
RUN npx prisma generate

# Compila TypeScript → dist/
RUN npm run build


#########################################
# 🔹 Etapa 2: Execução da aplicação
#########################################
FROM node:20-alpine

WORKDIR /app

# Copia package.json e instala apenas dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev

# Copia o build e schema Prisma do estágio anterior
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Gera novamente o Prisma Client no ambiente final
RUN npx prisma generate

# Define variáveis e porta
ENV NODE_ENV=production
EXPOSE 3000

# Comando de inicialização
CMD ["node", "dist/server.js"]
