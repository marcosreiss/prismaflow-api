# ==============================
# 🔹 Etapa 1: Build da aplicação
# ==============================
FROM node:20-alpine AS build

WORKDIR /app

# Copia apenas os arquivos de dependências primeiro (melhor uso de cache)
COPY package*.json ./
RUN npm install

# Copia o restante do código-fonte
COPY . .

# Gera o client Prisma antes do build TypeScript
RUN npx prisma generate

# Compila o TypeScript
RUN npm run build

# ==============================
# 🔹 Etapa 2: Execução da aplicação
# ==============================
FROM node:20-alpine

WORKDIR /app

# Copia o app já compilado
COPY --from=build /app ./

# Expõe a porta padrão
EXPOSE 3000

# Variável padrão (Render define automaticamente)
ENV NODE_ENV=production

# Comando de inicialização
CMD ["npm", "run", "start"]
