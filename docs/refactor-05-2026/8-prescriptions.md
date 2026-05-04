# Problemas resolvidos na refatoração — 02/05/2026 (módulo prescription)

## **prescription.dto.ts**

**Problema 1 — `clientId` sem validação numérica adequada**

O campo utilizava apenas `@IsNotEmpty()`, permitindo valores inválidos (zero, negativos ou decimais).

Corrigido com `@IsInt()` e `@IsPositive()`.

---

## **prescription.repository.ts**

**Problema 2 — mutação de `prescriptionDate` no create**

O repository alterava diretamente o objeto recebido. A conversão para `Date` deve ocorrer no service, mantendo o repository puro e tipado.

**Problema 3 — uso de `Error` genérico em validação**

O guard de `branchId` lançava `Error`, resultando em status 500. Substituído por `AppError` com código adequado.

**Problema 4 — `findById` sem filtro de `isActive`**

Prescrições inativas eram retornadas em operações de negócio.

**Problema 5 — listagens sem filtro de `isActive`**

Métodos como `findAllByTenant` e `findByClientId` incluíam registros soft-deletados.

**Problema 6 — lógica indevida no método `delete`**

O repository concentrava validação, decisão e logging. Responsabilidade movida para o service.

**Problema 7 — ausência de `softDelete`, `hardDelete` e `hasSales`**

Faltava separação clara de responsabilidades para controle de integridade.

---

## **prescription.service.ts**

**Problema 8 — erros retornados como valor (inconsistência de padrão)**

Substituído por `throw new AppError(...)`, garantindo integração com middleware global.

**Problema 9 — uso de `req.user!` sem verificação explícita**

Removida dependência implícita do `authGuard`.

**Problema 10 — tipagem incorreta e manipulação de payload**

Uso de `any` e manipulação indireta corrigidos com uso explícito dos DTOs.

**Problema 11 — update alterando `tenantId` e `branchId`**

Campos indevidos no payload de update. Removidos para evitar inconsistência e erro de tipagem.

**Problema 12 — regra de papel não aplicada em expiração**

ADMIN e MANAGER estavam limitados à filial. Ajustado para respeitar escopo do tenant.

**Problema 13 — delete sem lógica hard/soft**

Remoção direta substituída por decisão baseada em relacionamentos (`hasSales`).

**Problema 14 — `clientId` não validado no contexto do tenant (falha de segurança)**

Agora há verificação explícita para garantir que o cliente pertence ao tenant antes da criação.

---

## **prescription.controller.ts**

**Problema 15 — ausência de validação de parâmetros numéricos (NaN)**

Uso direto de `Number(req.params.id)` e `clientId` podia gerar erros genéricos. Adicionada validação centralizada (ex: `parseId`).

---

## **prescription.routes.ts**

Sem problemas estruturais.

Rotas organizadas corretamente e proteção de papéis adequada.

---

## **Resumo das correções**

| #   | Camada     | Problema                                   | Criticidade         |
| --- | ---------- | ------------------------------------------ | ------------------- |
| 1   | dto        | `clientId` sem validação numérica          | 🟠 Robustez         |
| 2   | repository | mutação de `prescriptionDate`              | 🟡 Qualidade        |
| 3   | repository | uso de `Error` genérico                    | 🔴 Bug              |
| 4   | repository | `findById` sem filtro de `isActive`        | 🟠 Regra de negócio |
| 5   | repository | listagens sem filtro de `isActive`         | 🟠 Regra de negócio |
| 6   | repository | lógica indevida no `delete`                | 🟡 Qualidade        |
| 7   | repository | ausência de soft/hard delete e `hasSales`  | 🟠 Integridade      |
| 8   | service    | erros retornados como valor                | 🟡 Qualidade        |
| 9   | service    | `req.user!` sem verificação                | 🟡 Qualidade        |
| 10  | service    | tipagem e manipulação incorreta de payload | 🟡 Qualidade        |
| 11  | service    | update alterando `tenantId`/`branchId`     | 🔴 Bug              |
| 12  | service    | regra de papel não aplicada corretamente   | 🟠 Regra de negócio |
| 13  | service    | delete sem lógica hard/soft                | 🟠 Integridade      |
| 14  | service    | `clientId` sem validação de tenant         | 🔴 Segurança        |
| 15  | controller | ausência de validação de `id` (NaN)        | 🟠 Robustez         |
