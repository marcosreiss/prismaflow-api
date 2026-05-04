# Problemas resolvidos na refatoração — 02/05/2026 (módulo client)

## **client.dto.ts**

Sem problemas identificados.

DTOs consistentes e adequados ao domínio.

---

## **client.repository.ts**

**Problema 1 — `create` e `update` com `data: any`**

Tipagem genérica em métodos públicos permite inconsistências silenciosas.

**Problema 2 — `findById` incluindo prescrições inativas**

O `include: { prescriptions: true }` retornava registros soft-deletados. Ajustado para considerar apenas prescrições ativas.

**Problema 3 — `findByNameInTenant` sem uso prático**

Clientes podem ter nomes duplicados. O método não era utilizado para validação e foi removido para evitar confusão.

**Problema 4 — duplicidade entre `findAllByTenant` e `findAllByTenantAndBranch`**

Métodos com responsabilidade sobreposta. Unificados com `branchId` opcional.

**Problema 5 — listagens sem filtro de `isActive`**

Clientes inativos apareciam em consultas padrão.

**Problema 6 — `findByNameForSelect` com `branchId` obrigatório**

Limitava indevidamente ADMIN/MANAGER, que devem acessar dados de todo o tenant.

**Problema 7 — `findBirthdays` sem filtro de `isActive`**

Clientes inativos incluídos indevidamente.

**Problema 8 — ausência de métodos de exclusão e verificação de vínculo**

Faltavam `softDelete`, `hardDelete` e `hasRelations`.

---

## **client.service.ts**

**Problema 9 — erros retornados como valor (inconsistência de padrão)**

Uso de `ApiResponse.error(...)` em vez de `throw new AppError(...)`.

**Problema 10 — uso de `req.user!` sem verificação explícita**

Dependência implícita do `authGuard`.

**Problema 11 — mutação do objeto `data` recebido**

Alterações diretas no payload (`tenantId`, `branchId`, `bornDate`). Corrigido para abordagem imutável.

**Problema 12 — ausência de validação de `branchId` no contexto**

Possível envio de `undefined` para campo NOT NULL, resultando em erro genérico no banco.

**Problema 13 — regras de papel ignoradas em `select` e `listBirthdays`**

ADMIN/MANAGER eram limitados indevidamente por `branchId`. Ajustado para permitir visão completa do tenant.

**Problema 14 — ausência de método de delete**

Nenhuma lógica de exclusão implementada.

---

## **client.controller.ts**

**Problema 15 — ausência de validação de `id` numérico (NaN)**

Uso direto de `Number(req.params.id)` pode gerar erro genérico no Prisma.

---

## **client.routes.ts**

**Problema 16 — endpoint DELETE ausente**

Nenhuma rota para exclusão de clientes.

**Problema 17 — endpoint `/:clientId/prescriptions` sem controle de papel (falha de segurança)**

Acesso liberado para qualquer usuário autenticado. Necessário aplicar `requireRoles`.

---

## **Resumo das correções**

| #   | Camada     | Problema                                               | Criticidade         |
| --- | ---------- | ------------------------------------------------------ | ------------------- |
| 1   | repository | `data: any` em create/update                           | 🟡 Qualidade        |
| 2   | repository | prescrições inativas retornadas no `findById`          | 🟠 Regra de negócio |
| 3   | repository | método sem utilidade (`findByNameInTenant`)            | 🟡 Qualidade        |
| 4   | repository | duplicidade de métodos de listagem                     | 🟡 Qualidade        |
| 5   | repository | ausência de filtro `isActive` em listagens             | 🟠 Regra de negócio |
| 6   | repository | filtro incorreto por `branchId` no select              | 🟠 Regra de negócio |
| 7   | repository | aniversariantes sem filtro de `isActive`               | 🟠 Regra de negócio |
| 8   | repository | ausência de soft/hard delete e verificação de vínculos | 🟠 Funcionalidade   |
| 9   | service    | erros retornados como valor                            | 🟡 Qualidade        |
| 10  | service    | `req.user!` sem verificação                            | 🟡 Qualidade        |
| 11  | service    | mutação do DTO                                         | 🟡 Qualidade        |
| 12  | service    | `branchId` indefinido chegando ao banco                | 🔴 Bug              |
| 13  | service    | regras de papel ignoradas em consultas                 | 🟠 Regra de negócio |
| 14  | service    | ausência de delete                                     | 🟠 Funcionalidade   |
| 15  | controller | ausência de validação de `id` (NaN)                    | 🟠 Robustez         |
| 16  | routes     | endpoint DELETE ausente                                | 🟠 Funcionalidade   |
| 17  | routes     | ausência de `requireRoles` em prescrições              | 🔴 Segurança        |
