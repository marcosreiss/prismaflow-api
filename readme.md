# 🚀 PrismaFlow API – Node

API REST modular desenvolvida com **Node.js**, **Express** e **TypeScript**, utilizando **Prisma ORM** para comunicação com o banco de dados **MySQL**.

A aplicação é **multi-tenant** (várias óticas) e **multi-branch** (várias filiais), com autenticação JWT, controle de acesso por perfil (RBAC) e padrões consolidados de arquitetura.

---

## 🧠 Tecnologias Utilizadas

| Categoria | Ferramenta | Função |
| --- | --- | --- |
| **Linguagem** | TypeScript | Tipagem estática e segurança de código |
| **Framework HTTP** | Express | Criação de rotas, controllers e middlewares |
| **ORM** | Prisma | Acesso e manipulação do banco de dados MySQL |
| **Autenticação** | JSON Web Token (JWT) | Geração e validação de tokens |
| **Criptografia** | BcryptJS | Hash e verificação de senhas |
| **Validação** | Class-Validator / Class-Transformer | Validação declarativa de DTOs |
| **Segurança** | Helmet | Proteção contra vulnerabilidades HTTP |
| **CORS** | Cors | Liberação de origens no backend |
| **Logs HTTP** | Morgan | Logs detalhados de requisições |
| **Variáveis de ambiente** | Dotenv | Carregamento de variáveis do `.env` |

---

## 🏗️ Estrutura Atual do Projeto

```
src/
 ├── config/
 │   ├── env.ts               # Variáveis de ambiente e configuração global
 │   └── prisma.ts            # Instância do Prisma Client
 │
 ├── middlewares/
 │   ├── global.middleware.ts # Helmet, Cors, Morgan, JSON parser
 │   ├── error.middleware.ts  # Tratamento centralizado de erros
 │   ├── auth.middleware.ts   # Validação e injeção do JWT (req.user)
 │   ├── authorize.middleware.ts # Controle de acesso por roles (RBAC)
 │   └── validation.middleware.ts # Middleware genérico de validação de DTOs
 │
 ├── responses/
 │   ├── ApiResponse.ts       # Modelo de resposta padrão
 │   └── PagedResponse.ts     # Modelo de resposta para listagens
 │
 ├── modules/
 │   ├── auth/                # Registro e login de usuários
 │   │   ├── dtos/
 │   │   │   ├── register-admin.dto.ts
 │   │   │   └── login.dto.ts
 │   │   ├── auth.controller.ts
 │   │   ├── auth.service.ts
 │   │   ├── auth.repository.ts
 │   │   └── index.ts
 │   │
 │   ├── branches/            # CRUD de filiais (branches)
 │   │   ├── dtos/
 │   │   │   └── create-branch.dto.ts
 │   │   ├── branch.controller.ts
 │   │   ├── branch.service.ts
 │   │   ├── branch.repository.ts
 │   │   └── index.ts
 │   │
 │   ├── users/               # CRUD de usuários (admin, manager, employee)
 │   │   ├── dtos/
 │   │   │   └── create-user.dto.ts
 │   │   ├── user.controller.ts
 │   │   ├── user.service.ts
 │   │   ├── user.repository.ts
 │   │   └── index.ts
 │
 ├── routes/
 │   └── index.ts             # Registro global das rotas
 │
 ├── types/
 │   └── express.d.ts         # Extensão da tipagem de Request (req.user)
 │
 └── server.ts                # Ponto de entrada da aplicação

```

---

## ⚙️ Banco de Dados (Prisma)

- **Banco:** MySQL
- **Schema principal:** `prisma/schema.prisma`
- **Modelos:** `Tenant`, `Branch`, `User`, `Role`
- **Relacionamentos:**
    - Um `Tenant` possui várias `Branch` e `User`
    - Uma `Branch` pertence a um `Tenant`
    - Um `User` pertence a um `Tenant` e opcionalmente a uma `Branch`

Exemplo de variável no `.env`:

```
DATABASE_URL="mysql://root:root@localhost:3306/prismaflowdb"
JWT_SECRET="minha_chave_segura"
PORT=3000

```

---

## 🔐 Fluxo de Autenticação e Permissões

| Papel | Pode criar usuários | Pode criar filiais | Observações |
| --- | --- | --- | --- |
| **ADMIN** | MANAGER / EMPLOYEE | ✅ | Acesso total dentro do tenant |
| **MANAGER** | EMPLOYEE | ❌ | Apenas dentro da própria filial |
| **EMPLOYEE** | ❌ | ❌ | Acesso restrito |
| **Sem token** | ❌ | ❌ | Acesso negado (401) |
- Login via `/auth/login` → gera JWT com `tenantId`, `role` e `branchId`
- Middleware `authGuard` valida o token
- Middleware `requireRoles()` controla permissões por rota

---

## 📦 Scripts NPM

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Executa o servidor em modo desenvolvimento |
| `npm run build` | Compila o TypeScript e gera o Prisma Client |
| `npm start` | Executa a versão compilada (produção) |
| `npx prisma migrate dev` | Aplica migrações no banco |
| `npx prisma studio` | Abre o painel visual do Prisma |

---

## 🧩 Coleção Postman

Uma coleção pronta (`PrismaFlow_API_Node.postman_collection.json`) está incluída no projeto, com rotas:

- **Auth:** `/auth/register-admin`, `/auth/login`
- **Branches:** `/branches`
- **Users:** `/users`

> O token JWT é salvo automaticamente nas variáveis do ambiente após o login.
> 

---

## 🧠 Boas Práticas e Padrões Atuais

- Estrutura modular por **módulo de negócio** (`auth`, `branches`, `users`)
- **DTOs validados** via `class-validator`
- **Autenticação JWT**
- **RBAC** (Role-Based Access Control)
- **Padrão de resposta unificado** com `ApiResponse`
- **Middlewares** para segurança, logs, erros e validação
- **Isolamento multi-tenant e multi-branch**
- **Código limpo, tipado e escalável**