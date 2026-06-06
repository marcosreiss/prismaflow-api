# Organização dos Módulos

## Estrutura padrão

O padrão mais comum em `src/modules/<modulo>` é:

- `*.routes.ts`
- `*.controller.ts`
- `*.service.ts`
- `*.repository.ts`
- `dtos/` ou `*.dto.ts`

Nos módulos core, controller tende a ser fino, service concentra regra de negócio e repository encapsula Prisma.

## Módulos principais

### `auth`

- cadastro inicial de tenant, filial e admin
- login
- seleção de filial para `ADMIN` sem `branchId`
- troca de senha
- cadastro administrativo de usuário

### `users`

- criação de usuários operacionais
- listagem paginada

Regras:

- `ADMIN` cria `MANAGER` e `EMPLOYEE`
- `MANAGER` cria apenas `EMPLOYEE`
- `MANAGER` só cria na própria filial

### `branches`

- criação de filiais
- listagem paginada
- listagem simplificada para seleção

### `brands`

- CRUD de marcas
- acesso restrito a `ADMIN`
- duplicidade por tenant

### `products`

- CRUD de produtos
- consulta de estoque
- valida marca no mesmo tenant
- exclusão com `softDelete` quando há histórico

### `optical-services`

- CRUD de serviços ópticos
- `branchId` do body é ignorado
- usuário precisa ter filial

### `clients`

- CRUD de clientes
- autocomplete
- aniversariantes
- prescrições do cliente
- CPF único por tenant

### `prescriptions`

- CRUD de prescrições
- listagem por cliente
- receitas vencidas

### `sales`

- criar, atualizar, listar, buscar e remover vendas
- recalcula subtotal e total na API
- cria `Payment` inicial `PENDING`
- atualiza estoque e `frameDetails`
- restringe edição quando já existe atividade financeira

### `payments`

- listagem e detalhe
- atualização de `discount` e `methods[]`
- atualização de status
- validação de integridade
- leitura e quitação de parcelas

Regras:

- `Payment` nasce com a venda
- no máximo 2 métodos
- no máximo 1 `INSTALLMENT`
- parcelas avançam por mês-calendário

### `expenses`

- CRUD de despesas
- acesso de `ADMIN` e `MANAGER`

### `dashboard`

- balanço
- resumo de vendas
- pagamentos por status
- top produtos
- top clientes
- parcelas em atraso

## Middlewares transversais

- `auth.middleware.ts`
- `authorize.middleware.ts`
- `validation.middleware.ts`
- `global.middleware.ts`
- `error.middleware.ts`
