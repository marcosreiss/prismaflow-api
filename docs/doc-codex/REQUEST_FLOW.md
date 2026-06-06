# Fluxo de Requisições

## Fluxo macro

`HTTP Request -> Router -> Middlewares -> Controller -> Service -> Repository/Prisma -> Response`

Em módulos mais simples, o service fala com repository. Em `sales` e `payments`, parte da lógica usa Prisma direto.

## Etapas padrão

### 1. Entrada

`src/server.ts` registra:

- middlewares globais
- rotas em `/api`
- middleware global de erro

### 2. Middlewares globais

- `express.json()`
- `cors(...)`
- `helmet()`
- `morgan("dev")`

### 3. Autenticação

Quando há `authGuard`:

1. lê `Authorization: Bearer <token>`
2. valida o JWT com `env.JWT_SECRET`
3. popula `req.user` com `sub`, `email`, `tenantId`, `branchId`, `role`, `iat`, `exp`

### 4. Autorização

Quando há `requireRoles(...)`:

1. lê `req.user.role`
2. compara com os papéis permitidos
3. retorna `403` se não houver acesso

### 5. Validação

`validateDto(...)`:

1. converte payload para DTO
2. valida com `class-validator`
3. remove campos não declarados
4. bloqueia extras com `400`
5. sobrescreve `req.body`, `req.query` ou `req.params`

### 6. Service

O service normalmente:

- injeta `tenantId` e `branchId`
- valida existência e integridade
- aplica regras de negócio
- chama repository ou Prisma
- monta `ApiResponse` ou `PagedResponse`

## Exemplos importantes

### Login com seleção de filial

`POST /api/auth/login`

- valida credenciais
- se `ADMIN` não tiver `branchId`:
  - com 1 filial, emite token final
  - com várias, retorna `tempToken`
- `POST /api/auth/branch-selection` valida o token temporário e emite o token final

### Criação de cliente

`POST /api/clients`

- autentica
- valida DTO
- injeta `tenantId` e `branchId`
- converte `bornDate`
- valida CPF único por tenant
- persiste via Prisma

### Criação de venda

`POST /api/sales`

- exige pelo menos um item
- valida cliente, prescrição e data
- calcula subtotal e total
- cria `Sale`
- cria itens e baixa estoque
- cria `Protocol` quando enviado
- cria `Payment` inicial com status `PENDING`

### Pagamento de parcela

`PATCH /api/payment-installments/:id/pay`

- valida a parcela
- valida tenant e status do pagamento
- impede quitação acima do saldo
- soma em `paidAmount`
- grava `paidAt` só na quitação total
- recalcula `paidAmount`, `installmentsPaid`, `lastPaymentAt` e `status` do `Payment`

## Datas e auditoria

- DTOs aceitam datas convertíveis para `Date`
- campos `@db.Date` voltam como `YYYY-MM-DD`
- `withAuditData(...)` preenche `createdById` e `updatedById`
