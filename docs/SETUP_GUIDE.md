# 🚀 Guia de Instalação e Configuração — PrismaFlow API (Node.js)

Este guia descreve **passo a passo** como configurar o ambiente local para rodar a **API PrismaFlow** desenvolvida com

**Node.js**, **Express**, **TypeScript** e **Prisma (MySQL)**.

---

## 🧩 Requisitos Mínimos

Antes de começar, certifique-se de ter instalado:

| Ferramenta | Versão mínima | Descrição |
| --- | --- | --- |
| **Node.js** | 18.x | Runtime JavaScript |
| **npm** ou **yarn** | 9.x / 1.x | Gerenciador de pacotes |
| **MySQL** | 8.x | Banco de dados relacional |
| **Git** | 2.x | Controle de versão |

Verifique com:

```bash
node -v
npm -v
mysql --version
git --version

```

---

## 📦 1️⃣ Clonar o Repositório

```bash
git clone https://github.com/<seu-usuario>/<nome-do-repo>.git
cd <nome-do-repo>

```

> Substitua <seu-usuario> e <nome-do-repo> pelo caminho real do repositório GitHub.
> 

---

## 📁 2️⃣ Instalar Dependências

```bash
npm install

```

ou, se preferir usar **yarn**:

```bash
yarn install

```

---

## ⚙️ 3️⃣ Configurar Variáveis de Ambiente

Crie um arquivo chamado `.env` na raiz do projeto com o seguinte conteúdo base:

```bash
# Banco de Dados
DATABASE_URL="mysql://root:root@localhost:3306/prismaflowdb"

# JWT (Token)
JWT_SECRET="minha_chave_segura"

# Porta do servidor
PORT=3000

```

> 🔒 Dica: nunca commite o .env no repositório.
> 
> 
> O valor de `JWT_SECRET` deve ser único e seguro em produção.
> 

---

## 🗄️ 4️⃣ Configurar o Banco de Dados (MySQL)

1. Crie um novo banco de dados local chamado `prismaflowdb`:
    
    ```sql
    CREATE DATABASE prismaflowdb;
    
    ```
    
2. Execute as migrações do Prisma para gerar as tabelas:
    
    ```bash
    npx prisma migrate dev
    
    ```
    
3. (Opcional) Visualize o banco com o **Prisma Studio**:
    
    ```bash
    npx prisma studio
    
    ```
    

---

## 🧠 5️⃣ Gerar o Prisma Client

Caso altere o schema, gere novamente o client:

```bash
npx prisma generate

```

---

## 🚀 6️⃣ Executar o Servidor

Para rodar em modo **desenvolvimento (com hot reload):**

```bash
npm run dev

```

Para rodar em modo **produção (build compilado):**

```bash
npm run build
npm start

```

> 🌍 O servidor iniciará por padrão em:
> 
> 
> ```
> http://localhost:3000
> 
> ```
> 

---

## 🔐 7️⃣ Testar as Rotas

Com o servidor rodando, você pode testar via:

- **Postman** (coleção já incluída: `PrismaFlow_API_Node.postman_collection.json`)
- **cURL** no terminal
- **Insomnia**, se preferir

Exemplo de teste:

```bash
curl -X POST http://localhost:3000/auth/register-admin \
-H "Content-Type: application/json" \
-d '{
  "tenantName": "Ótica Vision",
  "branchName": "Matriz São Luís",
  "name": "Admin Teste",
  "email": "admin@otica.com",
  "password": "123456"
}'

```

---

## 🧩 8️⃣ Scripts Disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor com **nodemon** |
| `npm run build` | Compila TypeScript e gera o Prisma Client |
| `npm start` | Executa a versão compilada |
| `npx prisma migrate dev` | Aplica migrações no banco |
| `npx prisma studio` | Interface visual do banco |
| `npx prisma format` | Formata o schema Prisma |

---

## 🧱 9️⃣ Estrutura Principal

```
src/
 ├── config/              # Configuração geral (env, prisma, audit)
 ├── middlewares/         # Middlewares globais e específicos
 ├── modules/             # Módulos (auth, users, branches, etc.)
 ├── responses/           # Padrões de resposta
 ├── routes/              # Registro global de rotas
 ├── types/               # Tipos e definições globais
 └── server.ts            # Ponto de entrada principal

```

---

## 🔧 10️⃣ Erros Comuns

| Erro | Causa | Solução |
| --- | --- | --- |
| `Error: P1001 (Can't reach database)` | MySQL não está rodando | Inicie o serviço MySQL |
| `Invalid JWT token` | JWT_SECRET diferente entre ambientes | Use o mesmo valor em `.env` |
| `Prisma schema changed` | Schema atualizado sem gerar client | Execute `npx prisma generate` |
| `Cannot find module 'prisma/client'` | Client Prisma ausente | Execute `npx prisma generate` |

---

## 🧠 11️⃣ Recomendações de Desenvolvimento

- Sempre rodar `npx prisma migrate dev` após alterar o schema.
- Usar DTOs com `class-validator` em todos os endpoints de entrada.
- Comitar apenas código, nunca `.env` ou `.env.local`.
- Usar **RBAC (roles)** para proteger as rotas críticas.
- Validar o payload com `validateDto()` e autenticar com `authGuard`.

---

## 🧾 12️⃣ Finalizando

✅ Após seguir todos os passos acima, sua API estará pronta e acessível em:

```
http://localhost:3000

```

Use o Postman incluído para testar os fluxos:

- `/auth/register-admin`
- `/auth/login`
- `/branches`
- `/users`