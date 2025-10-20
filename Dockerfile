##########################################
# 🔹 Etapa 1: Build da aplicação
#########################################
FROM node:20-alpine AS build

WORKDIR /app

# Copia apenas os manifests primeiro
COPY package*.json ./

# Instala dependências (sem postinstall automático)
RUN npm ci

# Copia o restante do código e o schema Prisma
COPY prisma ./prisma
COPY tsconfig*.json ./
COPY src ./src

# Gera o Prisma Client (agora com schema presente)
RUN npx prisma generate

# Compila o código TypeScript
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
