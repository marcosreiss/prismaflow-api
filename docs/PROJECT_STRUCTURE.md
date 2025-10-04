## 🧩 Estrutura Modular do Projeto

A arquitetura do **PrismaFlow API** é totalmente modular, separando claramente **responsabilidades** por camada:

- **Modelagem de dados (Prisma Schema)**
- **Acesso a dados (Repository)**
- **Regra de negócio (Service)**
- **Interface HTTP (Controller + Routes)**

Esse formato garante **coerência**, **facilidade de manutenção**, **reuso de código** e **expansão organizada** do sistema.

---

## 🧱 1️⃣ `prisma/schema.prisma` — Modelagem de Dados

A modelagem do banco é definida com o **Prisma ORM**, em `prisma/schema.prisma`.

Cada tabela é representada como um **model** que define seus campos, chaves e relacionamentos.

Exemplo simplificado:

```
model Branch {
  id          String   @id @default(cuid())
  name        String
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  users       User[]
  createdById String?
  updatedById String?
  createdBy   User?    @relation("BranchCreatedBy", fields: [createdById], references: [id])
  updatedBy   User?    @relation("BranchUpdatedBy", fields: [updatedById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

```

📘 **Padrões aplicados:**

- `id` padrão `cuid()` (para entidades simples vamos usar int autoincrement)
- `createdAt` e `updatedAt` automáticos
- Campos `createdById` e `updatedById` para auditoria
- Relacionamentos explícitos entre entidades

---

## 🧮 2️⃣ Repository — Camada de Acesso a Dados

Os **repositories** são responsáveis por toda comunicação direta com o banco via Prisma Client.

Eles **nunca aplicam lógica de negócio**, apenas interagem com o ORM.

📁 Exemplo: `src/modules/branches/branch.repository.ts`

```tsx
import { prisma, withAuditData } from "../../config/prisma-context";

export class BranchRepository {
  create(tenantId: string, name: string, userId?: string) {
    return prisma.branch.create({
      data: withAuditData(userId, { name, tenantId }),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  update(branchId: string, data: any, userId?: string) {
    return prisma.branch.update({
      where: { id: branchId },
      data: withAuditData(userId, data, true),
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
  }

  findAllByTenant(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return Promise.all([
      prisma.branch.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      prisma.branch.count({ where: { tenantId } }),
    ]).then(([items, total]) => ({ items, total }));
  }
}
```

📘 **Responsabilidades:**

- CRUD direto (`create`, `findMany`, `update`, etc.)
- Aplicar auditoria via `withAuditData`
- Tratar paginação (`page`, `limit`)

---

## ⚙️ 3️⃣ Service — Camada de Regras de Negócio

Os **services** orquestram o fluxo de operações.

Eles recebem o `req.user` (usuário autenticado), validam permissões e chamam os métodos do repository.

📁 Exemplo: `src/modules/branches/branch.service.ts`

```tsx
import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { BranchRepository } from "./branch.repository";

export class BranchService {
  private repo = new BranchRepository();

  async create(req: Request, name: string) {
    const user = req.user!;
    if (user.role !== "ADMIN") {
      return ApiResponse.error(
        "Apenas administradores podem criar filiais.",
        403,
        req
      );
    }

    const exists = await this.repo.findByNameInTenant(user.tenantId, name);
    if (exists) {
      return ApiResponse.error("Já existe uma filial com esse nome.", 409, req);
    }

    const branch = await this.repo.create(user.tenantId, name, user.sub);
    return ApiResponse.success("Filial criada com sucesso.", req, branch);
  }

  async list(req: Request) {
    const user = req.user!;
    if (user.role !== "ADMIN") {
      return ApiResponse.error("Acesso negado.", 403, req);
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const { items, total } = await this.repo.findAllByTenant(
      user.tenantId,
      page,
      limit
    );

    return ApiResponse.paged(
      "Filiais listadas com sucesso.",
      req,
      items,
      page,
      limit,
      total
    );
  }
}
```

📘 **Responsabilidades:**

- Receber e validar o contexto (`req.user`)
- Aplicar regras de negócio e permissões (RBAC)
- Delegar persistência ao repository
- Retornar resposta padronizada (`ApiResponse` ou `PagedResponse`)

---

## 🌐 4️⃣ Controller — Interface entre Rotas e Serviço

Os **controllers** são funções assíncronas que conectam as rotas HTTP aos métodos do service.

Eles não contêm lógica de negócio — apenas capturam dados e retornam a resposta.

📁 Exemplo: `src/modules/branches/branch.controller.ts`

```tsx
import { Request, Response, NextFunction } from "express";
import { BranchService } from "./branch.service";

const service = new BranchService();

export const createBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.body;
    const result = await service.create(req, name);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const listBranches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await service.list(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};
```

📘 **Responsabilidades:**

- Receber `req`, `res`, `next`
- Chamar o método correspondente do service
- Encaminhar erros para o middleware global

---

## 🛣️ 5️⃣ Rotas — `entity.routes.ts`

Cada módulo define seu próprio arquivo de rotas, responsável por registrar endpoints REST para a entidade.

📁 Exemplo: `src/modules/branches/branch.routes.ts`

```tsx
import { Router } from "express";
import { createBranch, listBranches } from "./branch.controller";
import { authGuard } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/authorize.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import { CreateBranchDto } from "./dtos/create-branch.dto";

export const branchRoutes = Router();

branchRoutes.post(
  "/",
  authGuard,
  requireRoles("ADMIN"),
  validateDto(CreateBranchDto, "body"),
  createBranch
);

branchRoutes.get("/", authGuard, requireRoles("ADMIN"), listBranches);
```

📘 **Responsabilidades:**

- Registrar endpoints (`GET`, `POST`, `PUT`, `DELETE`)
- Proteger rotas com `authGuard` e `requireRoles`
- Aplicar validações de entrada com DTOs
- Direcionar para o controller correspondente

---

## 🧱 6️⃣ Estrutura Completa de um CRUD

```
src/
 └── modules/
     └── clientes/
         ├── dtos/
         │   ├── create-cliente.dto.ts
         │   ├── update-cliente.dto.ts
         ├── cliente.repository.ts
         ├── cliente.service.ts
         ├── cliente.controller.ts
         └── cliente.routes.ts

```

Para criar uma nova entidade:

| Etapa | Arquivo                 | Responsabilidade                       |
| ----- | ----------------------- | -------------------------------------- |
| 1️⃣    | `schema.prisma`         | Definir o model Prisma                 |
| 2️⃣    | `cliente.repository.ts` | CRUD no banco via Prisma               |
| 3️⃣    | `cliente.service.ts`    | Regras de negócio e validações         |
| 4️⃣    | `cliente.controller.ts` | Funções de entrada HTTP                |
| 5️⃣    | `cliente.routes.ts`     | Definição das rotas Express            |
| 6️⃣    | `entity.routes.ts`      | Exportar rotas e service se necessário |

---

## ⚙️ 7️⃣ Padrões Recomendados

| Item                         | Padrão                                                              |
| ---------------------------- | ------------------------------------------------------------------- |
| **Camadas isoladas**         | Cada módulo deve ter dtos, repository, service, controller e rotas  |
| **Respostas unificadas**     | Sempre retornar `ApiResponse` ou `PagedResponse`                    |
| **Auditoria automática**     | Usar `withAuditData(userId, data)` em `create` e `update`           |
| **Paginação**                | Sempre incluir `page` e `limit` nos `GET` de listagem               |
| **Validação**                | Todos os `POST` e `PUT` devem usar DTOs (`class-validator`)         |
| **Permissões (RBAC)**        | Controlar acesso via `requireRoles()` no arquivo de rotas           |
| **Nomenclatura de arquivos** | Seguir o padrão `<entidade>.<camada>.ts` (ex: `cliente.service.ts`) |

---

## 🚀 8️⃣ Fluxo Resumido de um CRUD

```
HTTP Request (Express Route)
        ↓
DTO Validation (class-validator)
        ↓
authGuard + RBAC
        ↓
Controller (captura req/res)
        ↓
Service (regras de negócio)
        ↓
Repository (Prisma ORM)
        ↓
Database (MySQL)
        ↓
ApiResponse / PagedResponse → JSON final

```

---

## 📦 9️⃣ Padrão de Resposta da API (`ApiResponse` e `PagedResponse`)

Toda resposta da **PrismaFlow API** segue um **formato padronizado**, garantindo consistência entre endpoints e facilitando o consumo por aplicações front-end e serviços externos.

---

### 🧱 Estrutura Base — `ApiResponse<T>`

A classe `ApiResponse<T>` define o **formato genérico de todas as respostas HTTP** da API.

```tsx
import { Request } from "express";

export class ApiResponse<T> {
  status: number;
  message: string;
  data?: T;
  token?: string;
  timestamp: string;
  path: string;

  constructor(
    status: number,
    message: string,
    req: Request,
    data?: T,
    token?: string
  ) {
    this.status = status;
    this.message = message;
    this.data = data;
    this.token = token;
    this.timestamp = new Date().toISOString();
    this.path = req.originalUrl;
  }

  static success<T>(message: string, req: Request, data?: T, token?: string) {
    return new ApiResponse<T>(200, message, req, data, token);
  }

  static error(message: string, status: number, req: Request) {
    return new ApiResponse(status, message, req);
  }
}
```

### 🔹 Estrutura JSON resultante

Exemplo de resposta bem-sucedida:

```json
{
  "status": 200,
  "message": "Filial criada com sucesso.",
  "data": {
    "id": "br_123",
    "name": "Matriz São Paulo",
    "tenantId": "tnt_456"
  },
  "timestamp": "2025-10-04T14:22:15.412Z",
  "path": "/api/branches"
}
```

Exemplo de resposta de erro:

```json
{
  "status": 403,
  "message": "Acesso negado.",
  "timestamp": "2025-10-04T14:23:10.120Z",
  "path": "/api/branches"
}
```

---

### 🧭 Uso no Service

A classe é utilizada diretamente nos **services** para gerar respostas padronizadas:

```tsx
import { ApiResponse } from "../../responses/ApiResponse";

if (!user.isAdmin) {
  return ApiResponse.error("Acesso negado.", 403, req);
}

const branch = await this.repo.create(user.tenantId, name, user.sub);
return ApiResponse.success("Filial criada com sucesso.", req, branch);
```

---

## 📄 1️⃣0️⃣ Resposta Paginada — `PagedResponse<T>`

Para endpoints que retornam listas com paginação, usamos a classe `PagedResponse<T>`, que **herda de `ApiResponse`** e adiciona o objeto `PageData`.

```tsx
import { Request } from "express";
import { ApiResponse } from "./ApiResponse";

export interface PageData<T> {
  currentPage: number;
  totalPages: number;
  totalElements: number;
  limit: number;
  content: T[];
}

export class PagedResponse<T> extends ApiResponse<PageData<T>> {
  constructor(
    message: string,
    req: Request,
    items: T[],
    page: number,
    limit: number,
    total: number
  ) {
    const totalPages = Math.ceil(total / limit);

    const data: PageData<T> = {
      currentPage: page,
      totalPages,
      totalElements: total,
      limit,
      content: items,
    };

    super(200, message, req, data);
  }
}
```

---

### 🔹 Estrutura JSON paginada

```json
{
  "status": 200,
  "message": "Filiais listadas com sucesso.",
  "data": {
    "currentPage": 1,
    "totalPages": 3,
    "totalElements": 25,
    "limit": 10,
    "content": [
      { "id": "br_001", "name": "Matriz SP" },
      { "id": "br_002", "name": "Filial RJ" }
    ]
  },
  "timestamp": "2025-10-04T14:30:20.189Z",
  "path": "/api/branches"
}
```

---

### 🧭 Uso no Service

```tsx
import { PagedResponse } from "../../responses/PagedResponse";

const { items, total } = await this.repo.findAllByTenant(
  user.tenantId,
  page,
  limit
);

return new PagedResponse(
  "Filiais listadas com sucesso.",
  req,
  items,
  page,
  limit,
  total
);
```

---

### 📘 Boas práticas de uso

| Tipo de Resposta      | Método Recomendado      | Exemplo                                                         |
| --------------------- | ----------------------- | --------------------------------------------------------------- |
| **Sucesso simples**   | `ApiResponse.success()` | `ApiResponse.success("Criado", req, data)`                      |
| **Erro controlado**   | `ApiResponse.error()`   | `ApiResponse.error("Não autorizado", 401, req)`                 |
| **Listagem paginada** | `PagedResponse`         | `new PagedResponse("Listagem", req, items, page, limit, total)` |

---

### 💡 Benefícios do padrão

- **Uniformidade:** Todas as rotas retornam o mesmo formato de JSON
- **Rastreabilidade:** Cada resposta inclui `timestamp` e `path`
- **Extensibilidade:** Permite adicionar campos extras (ex: `token`, `meta`, etc.)
- **Integração simplificada:** Front-ends e consumidores externos podem tratar respostas de forma genérica

---

Com isso, **todas as respostas da API** seguem o mesmo padrão padronizado (`ApiResponse` e `PagedResponse`), garantindo **consistência, previsibilidade e clareza** em todo o ecossistema do projeto.

---

Essa estrutura modular e tipada garante que cada novo módulo (ex: _clientes_, _produtos_, _vendas_)

possa ser criado **em minutos**, mantendo o mesmo padrão limpo, escalável e rastreável de todo o sistema.
