# Problemas resolvidos na refatoração — 02/05/2026 (módulo auth)

## **auth.dto.ts**

**Problema 1 — `RegisterUserDto` permite `ADMIN` como role (falha de segurança)**

O uso de `@IsEnum(Role)` aceitava qualquer valor do enum, incluindo `ADMIN`. Além disso, `tenantId` e `branchId` eram recebidos via input externo, quando deveriam ser derivados do token autenticado.

**Problema 2 — `createdById` exposto no DTO**

O campo `createdById` era opcional e controlado pelo cliente, o que abre brecha para manipulação de auditoria e não agrega valor funcional.

---

## **auth.repository.ts**

**Problema 3 — uso de `ApiResponse.error` no repository (quebra de responsabilidade)**

A camada de persistência não deve lidar com conceitos de HTTP. O repository deve ser agnóstico, deixando validações para o service e erros como `P2002` serem tratados acima.

**Problema 4 — `createUser` recebendo dados sensíveis externamente**

A função aceitava `tenantId`, `branchId` e `createdById` vindos do cliente. Esses dados agora devem ser resolvidos no service e repassados de forma segura.

**Problema 5 — `createTenantWithAdmin` sem `branchId` no admin**

O admin é criado sem `branchId`, o que pode ser válido (multi-filial), mas não estava explícito. Além disso, campos de auditoria (`createdById`, `updatedById`) ficam `null`, o que é aceitável apenas por se tratar de um fluxo de bootstrap — devendo estar documentado.

---

## **auth.service.ts**

**Problema 6 — retorno de erro ao invés de exceção**

O service retornava `ApiResponse.error` ao invés de lançar exceções (`AppError`), quebrando o fluxo padrão com middleware global e dificultando o tratamento consistente de erros.

**Problema 7 — ausência de validação no `selectBranch` (falha de segurança)**

Não havia verificação se o `branchId` informado pertence ao tenant do usuário. Isso permitia acesso indevido a dados de outros tenants.

**Problema 8 — uso de fallback inseguro para `JWT_SECRET`**

O uso de `env.JWT_SECRET || "chave-padrao"` em múltiplos pontos representa risco em produção e duplicação de lógica. A variável deve ser obrigatória no ambiente.

---

## **auth.controller.ts**

**Problema 9 — resposta 201 mesmo em erro**

O controller retornava status `201` mesmo quando o service retornava erro como valor. Com o uso de exceções, o fluxo passa a ser padronizado e mais previsível, mantendo consistência com o middleware global.
