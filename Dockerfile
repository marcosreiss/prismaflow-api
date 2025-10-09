# ==============================
# 🔹 Etapa 1: Build da aplicação
# ==============================
FROM node:20-alpine AS build

WORKDIR /app

# Copia package.json e instala dependências
COPY package*.json ./
RUN npm install

# Copia o restante do código-fonte
COPY . .

# Gera o build TypeScript e Prisma
RUN npm run build
RUN npx prisma generate

# ==============================
# 🔹 Etapa 2: Execução da aplicação
# ==============================
FROM node:20-alpine

WORKDIR /app

# Copia arquivos do build anterior
COPY --from=build /app ./

# Expõe a porta padrão do Express
EXPOSE 3000

# Define variável de ambiente padrão (Render usa automaticamente)
ENV NODE_ENV=production

# Comando de inicialização
CMD ["npm", "run", "start"]
