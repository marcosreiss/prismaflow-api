# Problemas resolvidos na refatoração — 02/05/2026 (módulo optical-service)

## **optical-service.dto.ts**

**Problema 1 — `branchId` exposto no DTO (falha de segurança)**

O campo estava presente como opcional, permitindo envio pelo cliente. Porém, o `branchId` deve ser sempre derivado do token. O campo foi removido para evitar inconsistências e possíveis adulterações.

---

## **optical-service.repository.ts**

**Problema 2 — `create` e `update` com `data: any`**

Ausência de tipagem explícita, permitindo entrada de dados inválidos sem validação em tempo de compilação.

**Problema 3 — `findById` sem filtro por `tenantId` e `isActive` (falha de segurança)**

Busca apenas por `id`, permitindo acesso a dados de outros tenants e incluindo registros soft-deletados.

**Problema 4 — `findByNameInTenant` sem filtro de `isActive`**

Registros inativos bloqueavam criação de novos serviços com o mesmo nome.

**Problema 5 — `findAllByTenant` sem filtro de `isActive` e com `any`**

Listagem incluía registros soft-deletados e utilizava tipagem genérica desnecessária.

**Problema 6 — uso de `mode: "insensitive"` incompatível com MySQL**

Esse operador é exclusivo do PostgreSQL. No MySQL, já existe comparação case-insensitive por padrão — o uso gerava erro em runtime.

**Problema 7 — delete sem distinção e sem validação de relacionamento**

Ausência de separação entre `hardDelete`, `softDelete` e verificação de vínculos (`ItemOpticalService`), podendo gerar erro `P2003`.

---

## **optical-service.service.ts**

**Problema 8 — erros retornados como valor (inconsistência de padrão)**

Uso de `ApiResponse.error(...)` em vez de lançar `AppError`, quebrando o fluxo centralizado de tratamento de erros.

**Problema 9 — uso de `req.user!` sem verificação explícita**

Dependência implícita do `authGuard`. Deve haver validação explícita.

**Problema 10 — mutação do objeto `data` recebido**

Alteração direta do payload (`data.branchId = user.branchId`). Corrigido para passagem explícita e imutável ao repository.

**Problema 11 — ausência de validação de `branchId` obrigatório no contexto**

Se o usuário não possuir `branchId`, o erro ocorreria apenas no banco. Agora há validação prévia com erro explícito.

**Problema 12 — update sem verificação de duplicidade de nome**

Permitia duplicação de nomes dentro do tenant, já que não há constraint no banco.

**Problema 13 — delete sem lógica hard/soft**

Remoção direta sem considerar vínculos. Agora segue padrão com decisão baseada em relacionamentos.

---

## **optical-service.controller.ts**

**Problema 14 — ausência de validação de `id` numérico (NaN)**

Uso direto de `Number(req.params.id)` pode resultar em `NaN`, gerando erro genérico no Prisma. Deve ser validado previamente (ex: `parseId` reutilizável).

---

## **optical-service.routes.ts**

Sem problemas estruturais.

Rotas corretamente protegidas com `authGuard`. Como não há restrição de papel definida, o acesso para usuários autenticados está adequado.

---

## **Resumo das correções**

| #   | Camada     | Problema                                        | Criticidade         |
| --- | ---------- | ----------------------------------------------- | ------------------- |
| 1   | dto        | `branchId` exposto ao cliente                   | 🔴 Segurança        |
| 2   | repository | `data: any` em create/update                    | 🟡 Qualidade        |
| 3   | repository | `findById` sem filtro por tenant e `isActive`   | 🔴 Segurança        |
| 4   | repository | duplicidade considerando registros inativos     | 🟠 Regra de negócio |
| 5   | repository | listagem com `any` e sem filtro de `isActive`   | 🟡 Qualidade        |
| 6   | repository | uso inválido de `mode: "insensitive"` no MySQL  | 🔴 Bug              |
| 7   | repository | delete sem validação e sem distinção hard/soft  | 🟠 Integridade      |
| 8   | service    | erros retornados como valor                     | 🟡 Qualidade        |
| 9   | service    | `req.user!` sem verificação                     | 🟡 Qualidade        |
| 10  | service    | mutação direta do DTO                           | 🟡 Qualidade        |
| 11  | service    | ausência de validação de `branchId` no contexto | 🟠 Robustez         |
| 12  | service    | update sem validação de duplicidade             | 🟠 Regra de negócio |
| 13  | service    | delete sem lógica hard/soft                     | 🟠 Integridade      |
| 14  | controller | ausência de validação de `id` (NaN)             | 🟠 Robustez         |
