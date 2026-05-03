# Problemas resolvidos na refatoração — 02/05/2026 (módulo brand)

## **brand.dto.ts**

Sem problemas identificados.

DTOs bem definidos, uso correto de `@IsOptional` e validações como `@MaxLength` aplicadas adequadamente.

---

## **brand.repository.ts**

**Problema 1 — `create` e `update` com `data: any`**

Métodos públicos com tipagem genérica permitem entrada de dados inválidos sem erro em tempo de compilação. Devem utilizar tipos explícitos baseados nos campos permitidos.

**Problema 2 — `findById` sem filtro por `tenantId` (falha de segurança)**

A busca é feita apenas pelo `id`, sem considerar o tenant. Isso permite acessar registros de outros tenants, quebrando o isolamento multi-tenant.

**Problema 3 — `delete` sem tratamento de integridade referencial**

A exclusão física pode violar constraints (FK) caso existam produtos associados, resultando em erro `P2003` não tratado. É necessário validar previamente ou tratar o erro adequadamente.

**Problema 4 — uso de `whereClause: any`**

Tipagem desnecessária. O TypeScript consegue inferir corretamente o tipo, evitando o uso de `any`.

---

## **brand.service.ts**

**Problema 5 — erros retornados como valor (inconsistência de padrão)**

Uso de `ApiResponse.error(...)` em vez de lançar `AppError`, quebrando o fluxo padronizado de tratamento via middleware global.

**Problema 6 — uso de `req.user!` sem verificação explícita**

Assume implicitamente que o `authGuard` sempre foi aplicado. O service deve validar explicitamente a existência do usuário.

**Problema 7 — ausência de validação de nome duplicado no update**

Ao atualizar o nome da marca, não há verificação de unicidade dentro do tenant. Isso pode gerar erro `P2002` do banco sem tratamento adequado.

**Problema 8 — `data: any` repassado ao repository**

O service recebe dados não tipados e repassa diretamente. O ideal é usar o DTO como contrato explícito.

**Problema 9 — exclusão sem verificar produtos vinculados**

A remoção da marca ocorre sem checar dependências. Com o método `hasProducts`, é possível evitar erro de integridade e retornar resposta controlada.

---

## **brand.controller.ts**

**Problema 10 — ausência de validação de `id` numérico (NaN)**

Uso direto de `Number(req.params.id)` pode resultar em `NaN`. Isso gera erros genéricos no Prisma. A validação deve ser feita previamente no controller.

**Observação — reutilização de parsing de ID**

A lógica de parsing de IDs numéricos se repete em múltiplos módulos. Recomenda-se extrair para um util compartilhado (`parseId`) para evitar duplicação.

---

## **brand.routes.ts**

Sem problemas estruturais.

Todas as rotas possuem `authGuard`, `requireRoles("ADMIN")` e validação de DTO quando necessário.

**Observação — verificação de roles duplicada**

As validações de papel no service tornam-se redundantes, já que a rota já garante esse controle. Pode-se manter apenas a verificação de usuário autenticado (`if (!user)`) para simplificar.

---

## **Resumo das correções**

| #   | Arquivo    | Problema                                | Criticidade         |
| --- | ---------- | --------------------------------------- | ------------------- |
| 1   | repository | `data: any` em create/update            | 🟡 Qualidade        |
| 2   | repository | `findById` sem filtro por tenant        | 🔴 Segurança        |
| 3   | repository | delete sem tratamento de FK (`P2003`)   | 🟠 Robustez         |
| 4   | repository | uso de `any` em whereClause             | 🟡 Qualidade        |
| 5   | service    | erros retornados como valor             | 🟡 Qualidade        |
| 6   | service    | `req.user!` sem verificação             | 🟡 Qualidade        |
| 7   | service    | update sem validação de nome duplicado  | 🟠 Regra de negócio |
| 8   | service    | `data: any` repassado ao repository     | 🟡 Qualidade        |
| 9   | service    | delete sem checar vínculos com produtos | 🟠 Integridade      |
| 10  | controller | ausência de validação de `id` (NaN)     | 🟠 Robustez         |
