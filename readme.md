# 🚀 PrismaFlow API – Node

API REST modular desenvolvida com **Node.js**, **Express** e **TypeScript**, utilizando **Prisma ORM** para comunicação com o banco de dados **MySQL**.

A aplicação é **multi-tenant** (várias óticas) e **multi-branch** (várias filiais), com autenticação JWT, controle de acesso por perfil (RBAC), **auditoria completa de ações (quem criou e atualizou)** e padrões consolidados de arquitetura.

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
| **Auditoria** | Prisma + Helpers (`withAuditData`) | Registra automaticamente quem criou e atualizou cada entidade |
| **Paginação** | `PagedResponse` | Listagens com metadados (página, total, limite) |

---

## 🏗️ Estrutura Atual do Projeto

```
src/
 ├── config/
 │   ├── env.ts                   # Variáveis de ambiente e configuração global
 │   ├── prisma.ts                # Instância do Prisma Client
 │   └── prisma-context.ts        # Helper withAuditData() para auditoria automática
 │
 ├── middlewares/
 │   ├── global.middleware.ts     # Helmet, Cors, Morgan, JSON parser
 │   ├── error.middleware.ts      # Tratamento centralizado de erros
 │   ├── auth.middleware.ts       # Validação e injeção do JWT (req.user)
 │   ├── authorize.middleware.ts  # Controle de acesso por roles (RBAC)
 │   └── validation.middleware.ts # Middleware genérico de validação de DTOs
 │
 ├── responses/
 │   ├── ApiResponse.ts           # Modelo de resposta padrão
 │   └── PagedResponse.ts         # Modelo de resposta para listagens paginadas
 │
 ├── modules/
 │   ├── auth/                    # Registro e login de usuários
 │   │   ├── dtos/
 │   │   │   ├── register-admin.dto.ts
 │   │   │   └── login.dto.ts
 │   │   ├── auth.controller.ts
 │   │   ├── auth.service.ts
 │   │   ├── auth.repository.ts
 │   │   └── auth.routes.ts
 │   │
 │   ├── branches/                # CRUD de filiais (branches)
 │   │   ├── dtos/
 │   │   │   └── create-branch.dto.ts
 │   │   ├── branch.controller.ts
 │   │   ├── branch.service.ts
 │   │   ├── branch.repository.ts # Inclui auditoria e listagem paginada
 │   │   └── branch.routes.ts
 │   │
 │   ├── users/                   # CRUD de usuários (admin, manager, employee)
 │   │   ├── dtos/
 │   │   │   └── create-user.dto.ts
 │   │   ├── user.controller.ts
 │   │   ├── user.service.ts
 │   │   ├── user.repository.ts   # Inclui auditoria e listagem paginada
 │   │   └── user.routes.ts
 │
 ├── routes/
 │   └── index.ts                 # Registro global das rotas
 │
 ├── types/
 │   └── express.d.ts             # Extensão da tipagem de Request (req.user)
 │
 └── server.ts                    # Ponto de entrada da aplicação

```

---

## ⚙️ Banco de Dados (Prisma)

- **Banco:** MySQL
- **Schema principal:** `prisma/schema.prisma`
- **Modelos principais:** `Tenant`, `Branch`, `User`, `Role`
- **Campos de auditoria adicionados:**
    - `createdById` → referência ao usuário criador
    - `updatedById` → referência ao último usuário que atualizou
    - Relacionamentos:
        - `createdBy` e `updatedBy` (tipo `User?`)
        - Inversos (`usersCreated`, `usersUpdated`, `branchesCreated`, etc.)
- **Relacionamentos:**
    - Um `Tenant` possui várias `Branch` e `User`
    - Uma `Branch` pertence a um `Tenant`
    - Um `User` pertence a um `Tenant` e opcionalmente a uma `Branch`

📦 Exemplo de variáveis no `.env`:

```
DATABASE_URL="mysql://root:root@localhost:3306/prismaflowdb"
JWT_SECRET="minha_chave_segura"
PORT=3000

```

---

## 🔐 Fluxo de Autenticação e Permissões

| Papel | Pode criar usuários | Pode criar filiais | Pode listar usuários | Observações |
| --- | --- | --- | --- | --- |
| **ADMIN** | MANAGER / EMPLOYEE | ✅ | ✅ Todos do tenant | Acesso total dentro do tenant |
| **MANAGER** | EMPLOYEE | ❌ | ✅ Apenas employees da sua filial | Escopo limitado |
| **EMPLOYEE** | ❌ | ❌ | ❌ | Acesso restrito |
| **Sem token** | ❌ | ❌ | ❌ | Acesso negado (401) |
- Login via `/auth/login` → gera JWT com `tenantId`, `role`, `branchId`
- Middleware `authGuard` valida o token e injeta `req.user`
- Middleware `requireRoles()` controla permissões por rota
- Middleware de validação de DTOs protege dados de entrada

---

## 📜 Listagens Paginadas

### **Branches (`GET /branches`)**

- **Acesso:** somente `ADMIN`
- **Resposta:** utiliza `PagedResponse`
- **Campos retornados:**
    - `id`, `name`, `tenantId`
    - `createdBy.name`
    - `updatedBy.name`

### **Users (`GET /users`)**

- **Acesso:**
    - `ADMIN`: todos os usuários do tenant
    - `MANAGER`: apenas employees da sua filial
- **Resposta:** paginada via `PagedResponse`
- **Campos retornados:**
    - `id`, `name`, `email`, `role`, `branch`
    - `createdBy.name`
    - `updatedBy.name`

---

## 🧩 Auditoria de Ações (CreatedBy / UpdatedBy)

- Implementada via helper `withAuditData(userId, data, isUpdate)`
- Injetada automaticamente nos repositórios durante `create` e `update`
- Registra:
    - `createdById` / `updatedById` no banco
    - `createdBy.name` e `updatedBy.name` nas respostas da API
- Compatível com ações sem usuário autenticado (opcional)

📁 Arquivo responsável:

```
src/config/prisma-context.ts

```

---

## 📦 Scripts NPM

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Executa o servidor em modo desenvolvimento |
| `npm run build` | Compila o TypeScript e gera o Prisma Client |
| `npm start` | Executa a versão compilada (produção) |
| `npx prisma migrate dev` | Aplica migrações no banco |
| `npx prisma studio` | Abre o painel visual do Prisma |
| `npx prisma format` | Formata o schema e corrige metadados |

---

## 🧩 Coleção Postman

Coleção: **`PrismaFlow_API_Node.postman_collection.json`**

Rotas principais:

- **Auth:** `/auth/register-admin`, `/auth/login`
- **Branches:** `/branches` (CRUD + paginação)
- **Users:** `/users` (CRUD + paginação)
- **Alterar senha:** `/auth/change-password` *(requer token válido)*

> O token JWT é salvo automaticamente nas variáveis do ambiente após o login.
> 

---

## 🧠 Boas Práticas e Padrões Atuais

- Estrutura modular por **domínio de negócio**
- **DTOs validados** com `class-validator`
- **Autenticação JWT**
- **RBAC** (Role-Based Access Control)
- **Paginação padronizada** via `PagedResponse`
- **Auditoria completa** (`createdBy`, `updatedBy`)
- **Respostas unificadas** com `ApiResponse`
- **Middlewares** globais de segurança, logs e erros
- **Isolamento multi-tenant e multi-branch**
- **Código limpo, tipado e escalável**