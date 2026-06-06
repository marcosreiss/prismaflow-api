# Variáveis de Ambiente e Configuração

## Fontes principais

- `.env.example`
- `src/config/env.ts`
- `src/config/prisma-client.ts`
- `src/middlewares/global.middleware.ts`
- `src/utils/logger.ts`
- `tsconfig.json`
- `prisma/schema.prisma`

## Variáveis identificadas

### `DATABASE_URL`

- usada pelo Prisma
- conexão MySQL via `env("DATABASE_URL")`

### `PORT`

- lida em `src/config/env.ts`
- default `3000`

### `NODE_ENV`

- default `development`

### `JWT_SECRET`

- assinatura e verificação do JWT
- fallback atual: `default_secret`

### `DEBUG_LOGS`

- habilita nível `debug`

### `TZ`

- existe em `.env.example`
- não é centralizada em `env.ts`

## `env.ts`

Centraliza:

- `PORT`
- `NODE_ENV`
- `JWT_SECRET`

## Prisma

`src/config/prisma-client.ts`:

- detecta campos `DateTime @db.Date`
- converte retorno para `YYYY-MM-DD`
- percorre relações carregadas
- conecta no startup e loga sucesso ou falha

## Middlewares globais

- `express.json()`
- `cors(...)`
- `helmet()`
- `morgan("dev")`

### CORS

Origens hardcoded:

- `http://localhost:5173`
- `https://prismaflow.vercel.app`

`credentials: true`

## JWT

- token final: `2h`
- token temporário: `5m`
- payload comum: `sub`, `email`, `tenantId`, `branchId`, `role`

## Validação

`validateDto` usa:

- `plainToInstance`
- `validate`
- `whitelist: true`
- `forbidNonWhitelisted: true`

## Logging

`winston` com:

- níveis `error`, `warn`, `info`, `http`, `debug`
- colorização
- timestamp
- console

## TypeScript

- `target = ES2020`
- `module = CommonJS`
- `rootDir = src`
- `outDir = dist`
- `strict = true`
- `experimentalDecorators = true`
- `emitDecoratorMetadata = true`
- alias `@/* -> src/*`

## Observações

- `req.user` é estendido em `src/types/express.d.ts`
- métodos instantâneos: `PIX`, `MONEY`, `DEBIT`, `CREDIT`
- parcelas avançam por mês-calendário, não por 30 dias fixos
- `DEBUG_LOGS` não passa por `env.ts`
- CORS não é parametrizado por variável de ambiente
