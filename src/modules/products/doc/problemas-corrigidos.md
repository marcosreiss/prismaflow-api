# Problemas resolvidos na refatoração — 02/05/2026 (módulo product)

## **product.dto.ts**

Sem problemas identificados.

DTOs consistentes, com validações adequadas e separação correta entre create e update.

---

## **product.repository.ts**

**Problema 1 — `create` e `update` com `data: any`**

Ausência de tipagem explícita permite entrada de dados inválidos sem erro em tempo de compilação.

**Problema 2 — `findById` sem filtro por `tenantId` e `isActive` (falha de segurança)**

A busca apenas por `id` permitia acesso a produtos de outros tenants e incluía registros soft-deletados, comprometendo o isolamento e a lógica de negócio.

**Problema 3 — ausência de `findByIdRaw`**

Faltava um método que ignorasse o `isActive`, necessário para cenários históricos (ex: vendas com produtos inativos).

**Problema 4 — uso de `whereClause: any`**

Tipagem desnecessária — o TypeScript pode inferir corretamente.

**Problema 5 — verificação de duplicidade com `contains`**

Uso de `contains` causava falsos positivos (ex: “Ray-Ban” bloqueando “Ray-Ban Pro”). A verificação deve ser por igualdade exata.

**Problema 6 — delete sem distinção e sem validação de relacionamento**

A exclusão era sempre hard delete, sem verificar vínculos. Isso pode gerar erro `P2003`. Separação entre `hardDelete`, `softDelete` e `hasItemProducts` resolve o problema.

---

## **product.service.ts**

**Problema 7 — erros retornados como valor (inconsistência de padrão)**

Uso de `ApiResponse.error(...)` em vez de lançar `AppError`, quebrando o fluxo centralizado de erros.

**Problema 8 — uso de `req.user!` sem verificação explícita**

Dependência implícita do `authGuard`. Deve haver validação explícita no service.

**Problema 9 — validação redundante de `brandId`**

O DTO já garante obrigatoriedade e tipo. A verificação manual no service era desnecessária.

**Problema 10 — ausência de validação de tenant da marca (falha de segurança)**

O `brandId` era aceito sem verificar se pertence ao tenant do usuário.

**Problema 11 — update sem validação de duplicidade**

Alterações de nome ou marca não verificavam conflitos, podendo gerar erro `P2002` sem tratamento amigável.

**Problema 12 — delete sem lógica de hard/soft**

A exclusão não considerava relacionamentos. A decisão deve ser feita no service com base em `hasItemProducts`.

**Problema 13 — mutação do DTO e inconsistência de `branchId`**

O service mutava o objeto recebido (`data.branchId = user.branchId`). Além disso, `undefined` era usado em vez de `null`. Corrigido para passagem explícita e imutável.

---

## **product.controller.ts**

**Problema 14 — ausência de validação de `id` numérico (NaN)**

Uso direto de `Number(req.params.id)` pode resultar em `NaN`, gerando erros genéricos no Prisma. Deve ser validado previamente.

---

## **product.routes.ts**

**Problema 15 — ordem incorreta de rotas (`/:id` antes de `/:id/stock`)**

A rota genérica interceptava a específica devido à ordem de declaração no Express. A rota mais específica deve vir primeiro.

---

## **Resumo das correções**

| #   | Camada     | Problema                                      |
| --- | ---------- | --------------------------------------------- |
| 1   | repository | `data: any` em create/update                  |
| 2   | repository | `findById` sem filtro por tenant e `isActive` |
| 3   | repository | ausência de `findByIdRaw`                     |
| 4   | repository | uso de `any` em whereClause                   |
| 5   | repository | duplicidade com `contains`                    |
| 6   | repository | delete sem distinção e sem validação de FK    |
| 7   | service    | erros retornados como valor                   |
| 8   | service    | `req.user!` sem verificação                   |
| 9   | service    | validação redundante de `brandId`             |
| 10  | service    | marca sem validação de tenant                 |
| 11  | service    | update sem validação de duplicidade           |
| 12  | service    | delete sem lógica hard/soft                   |
| 13  | service    | mutação do DTO e inconsistência de `branchId` |
| 14  | controller | ausência de validação de `id` (NaN)           |
| 15  | routes     | ordem incorreta de rotas                      |
