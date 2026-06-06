# Arquitetura da Aplicação

## Visão geral

A API usa Express + TypeScript + Prisma sobre MySQL. O domínio principal é gestão operacional de óticas com múltiplos tenants e filiais.

O padrão dominante é:

`route -> controller -> service -> repository -> Prisma`

Esse fluxo é seguido com mais consistência nos módulos core refatorados. As exceções mais importantes estão em `sales` e `payments`, que usam `prisma` direto em partes do service por causa de transações e regras compostas.

## Bootstrap

Ponto de entrada: `src/server.ts`

Fluxo:

1. importa `reflect-metadata`
2. cria o app Express
3. registra `setupMiddlewares`
4. monta `/api`
5. registra `errorMiddleware`
6. sobe o servidor em `env.PORT`

## Stack

- Node.js
- Express 5
- TypeScript
- Prisma Client
- MySQL
- JWT
- `class-validator`
- `class-transformer`
- `bcryptjs`
- `winston`
- `morgan`, `helmet`, `cors`

## Camadas

### Rotas

- definem paths e middlewares
- conectam endpoint ao controller

### Controllers

- extraem dados de `req`
- chamam services
- respondem via `res.status(...).json(...)`
- normalmente delegam erro com `next(err)`

### Services

- concentram regras de negócio
- aplicam `tenantId`, `branchId` e `sub`
- validam integridade entre entidades
- decidem `softDelete` ou `hardDelete`
- executam fluxos compostos como venda, parcelas e estoque

### Repositories

- encapsulam consultas Prisma
- aplicam filtros e paginação
- montam `include` e `select`

### DTOs

- validam `body`, `query` e `params`
- usam `whitelist: true` e `forbidNonWhitelisted: true`

## Estrutura relevante

### `src/`

- `config/`: ambiente, Prisma e helpers
- `middlewares/`: auth, autorização, validação e erro
- `modules/`: domínio da API
- `responses/`: envelopes padronizados
- `routes/`: roteador raiz
- `types/`: extensão do Express
- `utils/`: logger, senha e helpers

### `prisma/`

- `schema.prisma`
- `migrations/`
- `seeds/`

## Rotas raiz expostas

- `/auth`
- `/branches`
- `/users`
- `/brands`
- `/products`
- `/optical-services`
- `/clients`
- `/prescriptions`
- `/sales`
- `/payments`
- `/payment-installments`
- `/expenses`
- `/dashboard`

A raiz `/api/` responde `PrismaFlow API funcionando!`.

## Multi-tenant e filial

O isolamento principal é por `tenantId`, com `branchId` como contexto operacional.

Padrões observados:

- quase todo modelo carrega `tenantId`
- muitos modelos também carregam `branchId`
- `req.user` recebe ambos via JWT
- services tratam o token como fonte de verdade

## Papéis

- `ADMIN`
- `MANAGER`
- `EMPLOYEE`

## Respostas, erros e auditoria

- `ApiResponse`: envelope padrão
- `PagedResponse`: paginação
- `errorMiddleware`: normaliza falhas
- `withAuditData(...)`: preenche `createdById` e `updatedById`

## Datas e logging

- campos `DateTime @db.Date` são convertidos para `YYYY-MM-DD`
- logs HTTP usam `morgan("dev")`
- logs de domínio usam `winston`
- `DEBUG_LOGS=true` habilita `debug`
