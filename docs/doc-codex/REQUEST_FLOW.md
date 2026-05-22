# Fluxo de Requisições

## Fluxo macro da aplicação

O caminho padrão de uma requisição HTTP nesta API é:

`Request HTTP -> Express Router -> Middlewares -> Controller -> Service -> Repository/Prisma -> Banco -> Service -> Controller -> Response`

Na prática, dependendo do módulo, o trecho `Service -> Repository/Prisma` pode ser:

- apenas via repository
- uma combinação de repository com acesso direto ao Prisma

## 1. Entrada pelo Express

O bootstrap em `src/server.ts` registra:

- middlewares globais
- prefixo `/api`
- middleware global de erro

## 2. Middlewares globais

Antes de entrar no domínio, a requisição passa por:

- `express.json()`
- `cors(...)`
- `helmet()`
- `morgan("dev")`

## 3. Resolução da rota

O roteador raiz em `src/routes/index.ts` identifica o módulo pelo prefixo:

- `/auth`
- `/clients`
- `/sales`
- `/payments`
- etc.

## 4. Autenticação

Quando um endpoint usa `authGuard`, o fluxo é:

1. lê `req.headers.authorization`
2. verifica prefixo `Bearer `
3. valida o JWT com `env.JWT_SECRET`
4. popula `req.user` com `sub`, `email`, `tenantId`, `branchId`, `role`, `iat` e `exp`

Se o token não existir ou for inválido, o middleware encerra com `401`.

## 5. Autorização

Quando o endpoint usa `requireRoles(...)`, o fluxo é:

1. lê `req.user.role`
2. compara com a lista permitida
3. retorna `403` em caso de papel não autorizado

## 6. Validação de DTO

Quando o endpoint usa `validateDto(...)`, o fluxo é:

1. seleciona a origem (`body`, `query` ou `params`)
2. converte o payload para instância da classe DTO
3. executa `validate(...)`
4. remove propriedades não declaradas
5. rejeita campos extras com `400`
6. sobrescreve `req[source]` com o objeto validado

## 7. Controller

O controller normalmente:

- extrai DTO e parâmetros
- chama o service
- responde com `res.status(result.status).json(result)`

Existem dois estilos observados:

### Estilo 1: repasse para middleware global

- `try`
- chama service
- responde
- `catch -> next(err)`

Esse é o estilo predominante após a refatoração dos módulos core.

## 8. Service

O service é a camada que conhece o domínio.

Atividades típicas:

- injeta `tenantId` e `branchId` do token
- ignora ou sobrescreve campos sensíveis que não devem vir do cliente
- valida existência de registros
- valida regras de negócio
- chama repositórios
- cria respostas com `ApiResponse` ou `PagedResponse`

## 9. Repository e Prisma

### Caminho padrão

No desenho mais comum:

`Service -> Repository -> prisma.<model>.<operation>()`

### Caminho híbrido

Em vendas e pagamentos, parte da lógica usa Prisma diretamente no service:

- transações
- criação de itens compostos
- atualizações coordenadas de estoque
- substituição completa de métodos de pagamento

## 10. Serialização de resposta

### Respostas simples

`ApiResponse.success(...)` e `ApiResponse.error(...)` produzem:

- `status`
- `message`
- `data` opcional
- `token` opcional
- `timestamp`
- `path`

### Respostas paginadas

`PagedResponse(...)` produz:

- `currentPage`
- `totalPages`
- `totalElements`
- `limit`
- `content`
- `stats` opcional

## Exemplo 1: fluxo de criação de cliente

`POST /api/clients`

Sequência:

1. rota aplica `authGuard`
2. rota aplica `requireRoles("ADMIN", "MANAGER", "EMPLOYEE")`
3. rota aplica `validateDto(CreateClientDto, "body")`
4. controller chama `ClientService.create(req, req.body)`
5. service injeta `tenantId` e `branchId` do token
6. service converte `bornDate` para `Date`
7. service verifica duplicidade de CPF no tenant
8. repository cria o cliente via Prisma
9. resposta volta em `ApiResponse.success(...)`

## Exemplo 2: fluxo de login com seleção de filial

`POST /api/auth/login`

Cenário especial:

- usuário `ADMIN` sem `branchId`

Sequência:

1. DTO valida e-mail e senha
2. service busca usuário por e-mail
3. service compara senha com hash
4. se o usuário é admin sem filial:
   - busca filiais do tenant
   - se houver uma única filial, emite token final imediatamente
   - se houver várias filiais, emite `tempToken` com `isTemp=true`
5. cliente chama `POST /api/auth/branch-selection` com token temporário
6. service valida o token temporário
7. service gera token final com `branchId` selecionado

## Exemplo 3: fluxo de criação de venda

`POST /api/sales`

Sequência detalhada:

1. rota valida `CreateSaleDto`
2. controller chama `SaleService.create(req)`
3. service lê `tenantId`, `branchId` e `sub`
4. valida que o cliente existe no tenant
5. valida que a venda possui ao menos um produto ou serviço
6. valida que a data da venda não é futura
7. calcula `subtotal` a partir dos itens e aplica `discount` para chegar a `total`
8. cria `Sale`
9. opcionalmente cria `Protocol`
10. para cada item de produto:
   - valida produto
   - valida estoque
   - reduz estoque
   - cria `ItemProduct`
   - cria `FrameDetails` se necessário
11. para cada item de serviço:
   - valida serviço
   - cria `ItemOpticalService`
12. cria `Payment` inicial `PENDING`

## Exemplo 4: fluxo de pagamento de parcela

`PATCH /api/payment-installments/:id/pay`

Sequência:

1. rota valida `PayInstallmentDto`
2. controller chama `PaymentInstallmentPayService.payInstallment(req)`
3. service busca a parcela
4. valida tenant
5. bloqueia pagamento se a parcela já estiver quitada
6. calcula saldo restante
7. rejeita valor acima do saldo
8. soma ao `paidAmount`
9. marca `paidAt` somente na quitação total
10. recalcula o payment agregado dentro de transação

## Fluxo de dados interno para datas

O projeto mistura datas com hora e datas sem hora.

Padrão observado:

- DTOs recebem string ISO ou valor transformável em `Date`
- Prisma armazena vários campos como `@db.Date`
- o Prisma estendido transforma esses campos de volta em `YYYY-MM-DD`

## Fluxo de auditoria

Quando há `userId` disponível, as chamadas de persistência normalmente passam por `withAuditData`.

Criação:

- `createdById`
- `updatedById`

Atualização:

- `updatedById`

## Fluxo de consistência financeira

O módulo de pagamentos adiciona um fluxo próprio:

1. valida soma dos métodos
2. gera parcelas para métodos parcelados usando avanço por mês-calendário
3. registra quitação parcial ou total
4. recalcula `paidAmount`, `installmentsPaid`, `lastPaymentAt` e `status`
5. expõe endpoint de validação de integridade
