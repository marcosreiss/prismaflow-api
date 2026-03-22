# Variáveis de Ambiente e Configuração

## Fontes observadas

As configurações desta API estão distribuídas principalmente em:

- `.env.example`
- `src/config/env.ts`
- `src/config/prisma-client.ts`
- `src/middlewares/global.middleware.ts`
- `src/utils/logger.ts`
- `tsconfig.json`
- `prisma/schema.prisma`

## Variáveis de ambiente identificadas

## `DATABASE_URL`

Uso:

- configurada no `datasource db` do Prisma
- utilizada para conexão MySQL

Formato esperado:

- string de conexão MySQL

## `PORT`

Uso:

- lida em `src/config/env.ts`
- usada em `src/server.ts`

Comportamento:

- default `3000`

## `NODE_ENV`

Uso:

- lida em `src/config/env.ts`
- usada também no logger

Comportamento:

- default `development`

## `JWT_SECRET`

Uso:

- assinatura e verificação dos JWTs
- fluxos de login, autenticação e seleção de filial

Comportamento:

- `src/config/env.ts` define fallback `default_secret`
- `AuthService` ainda usa fallback local `chave-padrao`

## `DEBUG_LOGS`

Uso:

- lida em `src/utils/logger.ts`

Comportamento:

- quando `true`, o logger em console usa nível `debug`
- caso contrário, usa `info`

## `TZ`

Uso observado:

- aparece em `.env.example`
- não é lida diretamente por um módulo específico

## Configuração de ambiente consolidada em `env.ts`

O arquivo `src/config/env.ts` centraliza apenas:

- `PORT`
- `NODE_ENV`
- `JWT_SECRET`

Ponto importante:

- `DATABASE_URL` não está exportada nesse objeto, pois o Prisma a consome diretamente do ambiente

## Configuração do Prisma

### Schema

Em `prisma/schema.prisma`:

- `provider = "mysql"`
- URL do datasource via `env("DATABASE_URL")`

### Cliente Prisma estendido

O projeto não usa apenas um `new PrismaClient()` puro. Em `src/config/prisma-client.ts`, o cliente é estendido com um hook em todas as operações de todos os modelos.

Esse hook:

- consulta metadados do schema em runtime
- detecta campos `DateTime` com `nativeType = Date`
- transforma `Date` em string `YYYY-MM-DD`
- percorre relações carregadas no payload retornado

## Conexão do Prisma

Ao subir a aplicação:

- o cliente tenta conectar imediatamente
- em caso de sucesso, loga o alvo do banco
- em caso de falha, escreve erro no console

## Contexto Prisma

Os arquivos `src/config/prisma.ts` e `src/config/prisma-context.ts` reexportam:

- `prisma`
- `withAuditData`
- `formatDateOnlyFieldsForModel`

## Auditoria por configuração auxiliar

### `withAuditData`

Comportamento:

- em criação, injeta `createdById` e `updatedById`
- em atualização, injeta `updatedById`

## Configuração de middlewares HTTP

Em `src/middlewares/global.middleware.ts`:

- `express.json()`
- `cors(...)`
- `helmet()`
- `morgan("dev")`

### CORS

Origens permitidas atualmente:

- `http://localhost:5173`
- `https://prismaflow.vercel.app`

Configuração:

- `credentials: true`

Observação importante:

- as origens estão hardcoded no código
- não há variável de ambiente para lista dinâmica de origens

## Configuração de autenticação

O JWT usa:

- segredo vindo de `JWT_SECRET`
- expiração de `2h` para token final
- expiração de `5m` para token temporário de seleção de filial

Payload final normalmente inclui:

- `sub`
- `email`
- `tenantId`
- `branchId`
- `role`

## Configuração de validação

O middleware `validateDto` usa:

- `plainToInstance`
- `validate`
- `whitelist: true`
- `forbidNonWhitelisted: true`

## Configuração de logging de domínio

O logger `winston` em `src/utils/logger.ts` define:

- níveis customizados: `error`, `warn`, `info`, `http`, `debug`
- colorização de logs
- timestamp formatado
- saída padrão em console

Não há, na implementação ativa:

- persistência em arquivo
- agregação externa

## Configuração TypeScript

Em `tsconfig.json`:

- `target = ES2020`
- `module = CommonJS`
- `rootDir = src`
- `outDir = dist`
- `strict = true`
- `experimentalDecorators = true`
- `emitDecoratorMetadata = true`

## Alias de importação

O projeto define:

- `@/* -> src/*`

## Extensão de tipos do Express

Em `src/types/express.d.ts`, o projeto adiciona `req.user` com:

- `sub`
- `email`
- `tenantId`
- `branchId`
- `role`
- `iat`
- `exp`

## Configurações implícitas importantes

- métodos instantâneos considerados pagos: `PIX`, `MONEY`, `DEBIT`, `CREDIT`
- geração de parcelas em intervalos de 30 dias
- clientes aniversariantes usam `America/Sao_Paulo` quando não há data na query
- CORS é fixo em código

## Riscos e observações de configuração

- `JWT_SECRET` tem fallbacks diferentes em arquivos distintos
- `DEBUG_LOGS` é usado pelo logger, mas não é centralizado em `env.ts`
- `TZ` aparece no exemplo, mas não estrutura todo o tratamento de timezone
- a lista de origens CORS não é parametrizada
