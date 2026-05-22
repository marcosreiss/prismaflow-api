# Organização dos Módulos

## Estrutura padrão por módulo

O padrão mais comum em `src/modules/<modulo>` é:

- `*.routes.ts`: define endpoints e middlewares
- `*.controller.ts`: traduz HTTP para chamadas de service
- `*.service.ts`: aplica regras de negócio
- `*.repository.ts`: encapsula operações Prisma
- `dtos/` ou `*.dto.ts`: valida contratos de entrada

Após a refatoração dos módulos core, o padrão esperado ficou mais explícito:

- controller orquestra `req/res` e encaminha erro com `next(err)`
- service concentra regra de negócio, tenant, branch, duplicidade e integridade
- repository faz acesso a dados e consultas auxiliares como `hasRelations`

No módulo de pagamentos, a estrutura é mais segmentada e usa subpastas para `controller`, `repository`, `routes`, `services`, `dtos` e `doc`.

## Módulos de autenticação e identidade

### `auth`

Responsabilidade:

- cadastro inicial do tenant com administrador
- login
- seleção de filial para administradores sem `branchId` fixo
- troca de senha
- cadastro administrativo de usuários

Observações:

- o fluxo de login possui desvio específico para `ADMIN` sem filial associada
- nesse caso a API emite um token temporário e exige seleção de filial
- o repository usa transação Prisma para criar tenant, primeira filial e primeiro admin de forma atômica
- `register-user` administrativo foi enxugado: o corpo informa `name`, `email`, `password` e `role`, enquanto `tenantId` e `branchId` vêm do token

### `users`

Responsabilidade:

- criação de usuários operacionais por papel
- listagem paginada conforme perfil do solicitante

Regras centrais:

- `ADMIN` cria `MANAGER` e `EMPLOYEE`
- `MANAGER` cria apenas `EMPLOYEE`
- `EMPLOYEE` não cria usuários
- `MANAGER` só cria funcionário na própria filial
- listagem para `MANAGER` retorna apenas `EMPLOYEE` da própria filial

Observação de coexistência:

- o módulo `auth` também possui `register-user`
- o módulo `users` implementa outra trilha de criação com regras mais detalhadas por papel

## Módulos de estrutura organizacional

### `branches`

Responsabilidade:

- criar filiais
- listar filiais do tenant
- listar filiais em modo seleção

Regra principal:

- criação e listagem completa são restritas a `ADMIN`

### Multi-tenancy aplicado

O `BranchRepository` sempre trabalha com `tenantId` como filtro principal. Existe ainda a constraint única composta:

- `tenantId + name`

## Módulos de catálogo

### `brands`

Responsabilidade:

- CRUD de marcas

Características:

- restrito a `ADMIN`
- paginação com `search`
- valida duplicidade de nome no tenant antes da criação
- impede exclusão quando já há produtos vinculados

Observação importante:

- no schema Prisma, `Brand.name` é globalmente `@unique`
- já o service valida por tenant

### `products`

Responsabilidade:

- CRUD de produtos
- consulta de estoque por produto

Regras relevantes:

- `brandId` é obrigatório na criação
- o service injeta `tenantId` e `branchId` do usuário
- há validação de duplicidade por `nome + marca` dentro do tenant
- listagem aceita filtros por categoria, marca e busca textual
- a exclusão decide entre `softDelete` e `hardDelete` conforme histórico em `itemProduct`

### `optical-services`

Responsabilidade:

- CRUD de serviços ópticos

Regras relevantes:

- `branchId` do payload é ignorado; vale o `branchId` do token
- exige que o usuário autenticado tenha filial associada
- valida duplicidade por nome dentro do tenant
- a exclusão faz `softDelete` quando já houve uso em venda e `hardDelete` quando não há vínculos

## Módulos de relacionamento com cliente

### `clients`

Responsabilidade:

- CRUD de clientes
- seleção simplificada para autocomplete
- aniversariantes
- relacionamento com prescrições

Características:

- o service injeta `tenantId` e `branchId`
- o CPF é único por tenant
- há tratamento explícito para `P2002`
- `EMPLOYEE` fica restrito à própria filial em listagem, seleção e aniversariantes
- `ADMIN` e `MANAGER` podem usar filtro opcional por `branchId`
- aniversariantes usam SQL bruto com `DAY()` e `MONTH()`
- a exclusão faz `softDelete` quando há vínculos como prescrições ou vendas

### `prescriptions`

Responsabilidade:

- CRUD de receitas/prescrições
- listagem paginada
- listagem por cliente
- receitas vencidas

Características:

- o service injeta `tenantId` e `branchId`
- o modelo armazena muitos campos ópticos
- `EMPLOYEE` fica restrito à própria filial nas listagens; `ADMIN` e `MANAGER` podem filtrar por `branchId`
- a exclusão é permitida apenas para `ADMIN` e `MANAGER`
- a exclusão faz `softDelete` quando a receita já foi usada em venda

## Módulo de vendas

### `sales`

Responsabilidade:

- criar venda
- atualizar venda
- listar vendas
- buscar venda por ID
- remover venda

O `SaleService` coordena:

- `SaleRepository`
- `ProductRepository`
- `OpticalServiceRepository`
- `ClientRepository`
- `PaymentRepository`
- `prisma` direto via contexto

Particularidades:

- subtotal e total são recalculados pela API; o cliente informa apenas `discount`
- a criação ocorre em transação e já gera `Payment` inicial com `status = PENDING`
- o service cria diretamente `itemProduct`, `frameDetails` e `itemOpticalService`
- a atualização bloqueia mudanças incompatíveis quando já existe atividade financeira
- a remoção restaura estoque e faz deleção física em cascata de `sale` e dependências

## Módulo de pagamentos

### `payments`

Responsabilidade:

- leitura e atualização de pagamento
- atualização de status
- validação de integridade
- listagem com filtros ricos
- consulta de parcelas
- registro de pagamento de parcela

Estrutura interna:

- `payment.service.ts`
- `payment-update.service.ts`
- `payment-installment.service.ts`
- `payment-installment-pay.service.ts`
- `payment-integrity.service.ts`

Separação:

- `PaymentService`: listagem, consulta e validação
- `PaymentUpdateService`: atualização, status e validação
- `PaymentInstallmentService`: leitura e edição de parcelas
- `PaymentInstallmentPayService`: quitação de parcelas
- `PaymentIntegrityService`: geração, validação e recálculo

Observação:

- `Payment` não é criado nem removido manualmente por endpoint próprio; ele nasce junto com a venda
- `PaymentUpdateService` usa `prisma.$transaction` diretamente
- atualização aceita essencialmente `discount` e substituição completa de `methods[]`
- a geração de parcelas usa incremento de mês-calendário, não soma fixa de 30 dias
- cancelamento de pagamento restaura estoque dos produtos da venda vinculada

## Módulo financeiro complementar

### `expenses`

Responsabilidade:

- CRUD de despesas

Características:

- restrito a `ADMIN` e `MANAGER`
- converte `dueDate` e `paymentDate` para `Date`
- aceita filtro por filial, status e texto

## Módulo analítico

### `dashboard`

Responsabilidade:

- balanço
- resumo de vendas
- pagamentos por status
- top produtos
- top clientes
- parcelas em atraso

Características:

- disponível para `ADMIN` e `MANAGER`
- `ADMIN` pode filtrar por filial via query
- `MANAGER` fica limitado à sua filial
- o repository usa `aggregate`, `groupBy` e `findMany`

## Middlewares transversais

- `auth.middleware.ts`: autenticação JWT e `req.user`
- `authorize.middleware.ts`: autorização por papel
- `validation.middleware.ts`: DTOs, whitelist e bloqueio de campos extras
- `global.middleware.ts`: JSON, CORS, Helmet e Morgan
- `error.middleware.ts`: envelope de erro padronizado

## Padrão de dependência entre camadas

Fluxo predominante:

- rota depende de controller
- controller depende de service
- service depende de repository
- repository depende de Prisma

Exceções relevantes:

- `SaleService` depende também de `prisma`
- `PaymentUpdateService` depende também de `prisma`
- `PaymentInstallmentPayService` e `PaymentIntegrityService` concentram regras financeiras que extrapolam o CRUD simples
