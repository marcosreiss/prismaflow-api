## 🧾 Auditoria — Exemplo de Retorno na API

A auditoria está presente em todas as entidades principais do sistema (`User`, `Branch`, `Tenant`) e mostra **quem criou e quem atualizou** o registro.

Esses campos aparecem automaticamente nas respostas das rotas, graças à configuração `include` feita nos repositórios.

---

### 🏢 **Exemplo — Criação de Filial (`POST /branches`)**

**Requisição:**

```json
{
  "name": "Ótica Centro"
}
```

**Resposta:**

```json
{
  "success": true,
  "message": "Filial criada com sucesso.",
  "data": {
    "id": "br_01j9xyz72h",
    "name": "Ótica Centro",
    "tenantId": "ten_01j8b32v7x",
    "createdBy": { "name": "Diogo França" },
    "updatedBy": { "name": "Diogo França" },
    "createdAt": "2025-10-05T14:28:10.234Z",
    "updatedAt": "2025-10-05T14:28:10.234Z"
  },
  "timestamp": "2025-10-05T14:28:10.500Z"
}
```

---

### 👤 **Exemplo — Criação de Usuário (`POST /users`)**

**Requisição (ADMIN criando funcionário):**

```json
{
  "name": "Maria Souza",
  "email": "maria@otica.com",
  "password": "123456",
  "role": "EMPLOYEE",
  "branchId": "br_01j9xyz72h"
}
```

**Resposta:**

```json
{
  "success": true,
  "message": "Usuário criado com sucesso.",
  "data": {
    "id": "usr_01j9xyz81p",
    "name": "Maria Souza",
    "email": "maria@otica.com",
    "role": "EMPLOYEE",
    "branch": {
      "id": "br_01j9xyz72h",
      "name": "Ótica Centro"
    },
    "createdBy": { "name": "Diogo França" },
    "updatedBy": { "name": "Diogo França" },
    "createdAt": "2025-10-05T14:32:55.220Z",
    "updatedAt": "2025-10-05T14:32:55.220Z"
  },
  "timestamp": "2025-10-05T14:32:55.530Z"
}
```

---

### 📋 **Exemplo — Listagem Paginada (`GET /users?page=1&limit=10`)**

**Resposta:**

```json
{
  "success": true,
  "message": "Usuários listados com sucesso.",
  "data": {
    "currentPage": 1,
    "totalPages": 2,
    "totalElements": 12,
    "limit": 10,
    "content": [
      {
        "id": "usr_01j9xyz81p",
        "name": "Maria Souza",
        "email": "maria@otica.com",
        "role": "EMPLOYEE",
        "branch": { "id": "br_01j9xyz72h", "name": "Ótica Centro" },
        "createdBy": { "name": "Diogo França" },
        "updatedBy": { "name": "Diogo França" }
      },
      {
        "id": "usr_01j9xyz91q",
        "name": "João Lima",
        "email": "joao@otica.com",
        "role": "MANAGER",
        "branch": { "id": "br_01j9xyz72h", "name": "Ótica Centro" },
        "createdBy": { "name": "Diogo França" },
        "updatedBy": { "name": "Maria Souza" }
      }
    ]
  },
  "timestamp": "2025-10-05T14:35:10.000Z"
}
```

---

### 🧩 **Comportamento Automático**

| Ação                    | Campos Atualizados           | Origem do Usuário |
| ----------------------- | ---------------------------- | ----------------- |
| `create()`              | `createdById`, `updatedById` | `req.user.sub`    |
| `update()`              | `updatedById`                | `req.user.sub`    |
| Sem usuário autenticado | Nenhum campo é adicionado    | —                 |

## 🔧 Implementação Técnica da Auditoria

O sistema implementa um mecanismo de **auditoria automática**, garantindo que todas as entidades registrem **quem criou e quem atualizou** cada item, de forma centralizada e reutilizável.

A funcionalidade é baseada em um **helper utilitário** chamado `withAuditData()`, que injeta automaticamente os campos `createdById` e `updatedById` nos registros manipulados via Prisma ORM.

---

### 🧱 **Helper Central — `withAuditData()`**

📄 Localização: `src/config/prisma-context.ts`

```tsx
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export function withAuditData<T extends Record<string, any>>(
  userId: string | undefined,
  data: T,
  isUpdate = false
): T {
  if (!userId) return data;

  if (isUpdate) {
    return { ...data, updatedById: userId };
  }

  return {
    ...data,
    createdById: userId,
    updatedById: userId,
  };
}
```

---

### ⚙️ **Como Funciona**

| Operação                | Ação                      | Campos Registrados            |
| ----------------------- | ------------------------- | ----------------------------- |
| `create()`              | Novo registro             | `createdById` e `updatedById` |
| `update()`              | Alteração de registro     | `updatedById`                 |
| Sem usuário autenticado | Nenhum campo é adicionado | —                             |

- O `userId` vem de `req.user.sub` (ou `req.user.id`), injetado pelo `authGuard`.
- Caso a ação seja feita sem autenticação (ex: registro inicial de admin), os campos são ignorados automaticamente.

---

### 🧩 **Uso nos Repositórios**

### 📘 Exemplo: `branch.repository.ts`

```tsx
return prisma.branch.create({
  data: withAuditData(userId, { name, tenantId }),
  include: {
    createdBy: { select: { name: true } },
    updatedBy: { select: { name: true } },
  },
});
```

### 📘 Exemplo: `user.repository.ts`

```tsx
return prisma.user.update({
  where: { id },
  data: withAuditData(userId, data, true),
  include: {
    createdBy: { select: { name: true } },
    updatedBy: { select: { name: true } },
  },
});
```

---

### 🧠 **Benefícios**

| Vantagem                 | Descrição                                                                   |
| ------------------------ | --------------------------------------------------------------------------- |
| ✅ Centralização         | Toda a lógica de auditoria está concentrada em uma única função             |
| 🧩 Reuso total           | Reutilizável em qualquer repositório sem duplicação de código               |
| 🔒 Segurança             | Garante rastreabilidade de todas as ações do sistema                        |
| ⚙️ Compatibilidade       | Funciona mesmo sem usuário autenticado                                      |
| 🧾 Clareza nas respostas | `createdBy.name` e `updatedBy.name` são retornados automaticamente nas APIs |

---

### 📊 **Fluxo Resumido**

```
Controller → Service → Repository → withAuditData() → Prisma → DB
                                 ↳ injeta createdById / updatedById
                                 ↳ inclui createdBy / updatedBy.name na resposta

```

---

Essa implementação garante **auditoria completa, automática e transparente**, sem comprometer a simplicidade dos serviços e controllers.
