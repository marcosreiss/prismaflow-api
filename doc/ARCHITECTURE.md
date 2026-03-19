# Arquitetura da Aplicação

## Visão geral

O projeto é uma API HTTP construída com Express e TypeScript, usando Prisma como camada de acesso a dados sobre MySQL. A aplicação organiza o código por módulos de domínio, cada um com rotas, controller, service, repository e DTOs próprios, com variações conforme a complexidade do caso de uso.

O domínio principal é o de gestão operacional de uma ótica com múltiplos tenants e múltiplas filiais.

## Bootstrap da aplicação

O ponto de entrada é `src/server.ts`.

Fluxo de inicialização:

1. importa `reflect-metadata`
2. cria a instância Express
3. registra middlewares globais em `setupMiddlewares`
4. monta todas as rotas sob o prefixo `/api`
5. registra o middleware global de erros
6. inicia o servidor na porta definida em `env.PORT`

## Stack principal

- Node.js
- Express 5
- TypeScript
- Prisma Client
- MySQL
- JWT para autenticação
- `class-validator` e `class-transformer` para validação de entrada
- `bcryptjs` para hash de senhas
- `winston` para logging customizado
- `morgan`, `helmet` e `cors` como middlewares HTTP

## Arquitetura lógica

### Camadas predominantes

#### Rotas

As rotas fazem o binding entre URL, middlewares de autenticação/autorização/validação e handlers do controller.

Responsabilidades:

- declarar o caminho HTTP
- definir middlewares por endpoint
- acionar o controller correspondente

#### Controllers

Os controllers são finos na maior parte dos módulos.

Responsabilidades:

- extrair dados de `req`
- chamar o service
- converter o retorno do service em resposta HTTP
- encaminhar erros para `next(err)` ou responder diretamente, dependendo do módulo

Observação importante:

- há controllers padronizados com `try/catch` e `next(err)`
- há controllers que respondem erro diretamente com `res.status(400).json(...)`
- portanto, o tratamento global de erro não é o único caminho de falha na aplicação

#### Services

Os services concentram a lógica de negócio.

Responsabilidades típicas:

- validar regras além da validação estrutural do DTO
- aplicar contexto do usuário autenticado (`tenantId`, `branchId`, `sub`, `role`)
- coordenar chamadas a repositories
- construir respostas com `ApiResponse` ou `PagedResponse`
- disparar processos compostos, como geração de parcelas ou baixa/restauração de estoque

Observação arquitetural:

- o padrão esperado seria service depender apenas de repositories
- na implementação atual isso não é sempre verdade
- `SaleService` e partes do módulo de pagamentos usam `prisma` diretamente, inclusive com transações

#### Repositories

Os repositories encapsulam o acesso ao Prisma.

Responsabilidades:

- persistência e leitura
- paginação e filtros
- `include` e `select` dos agregados retornados
- soft delete em entidades que usam `isActive`

Há módulos em que o repository é a única camada com Prisma. Em outros, ele divide essa responsabilidade com o service.

#### DTOs

Os DTOs definem o contrato estrutural das entradas.

Responsabilidades:

- validar campos obrigatórios
- validar tipos, enums, datas e numéricos
- rejeitar propriedades não declaradas via `forbidNonWhitelisted`
- transformar payloads via `class-transformer`

## Estrutura de diretórios relevante

### `src/`

- `config/`: cliente Prisma, contexto Prisma, ambiente
- `middlewares/`: autenticação, autorização, validação, erro global e middlewares HTTP globais
- `modules/`: domínio principal da aplicação
- `responses/`: envelopes padronizados de resposta
- `routes/`: agregador raiz de rotas
- `types/`: extensão de tipos do Express
- `utils/`: logging e utilitários de senha

### `prisma/`

- `schema.prisma`: modelo canônico de dados
- `migrations/`: histórico de migrações
- `seeds/`: scripts de carga inicial

## Módulos expostos pela API

O agregador de rotas em `src/routes/index.ts` registra os seguintes grupos:

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

Há ainda uma rota raiz `/api/` que responde com uma mensagem simples de health básico.

## Multi-tenant e segmentação por filial

O projeto usa dois níveis principais de contexto:

- `tenantId`: separação lógica entre óticas
- `branchId`: separação entre filiais dentro do tenant

Padrões observados:

- quase todos os modelos de negócio carregam `tenantId`
- muitos modelos também carregam `branchId`
- o JWT injeta ambos em `req.user`
- services normalmente ignoram `tenantId` e `branchId` enviados pelo cliente, usando o token como fonte de verdade

Exemplos:

- criação de cliente injeta `tenantId` e `branchId` do usuário
- criação de serviço óptico força `branchId` vindo do token
- listagens podem permitir filtro opcional por filial, especialmente para `ADMIN`

## Papéis e autorização

Os papéis definidos no schema Prisma são:

- `ADMIN`
- `MANAGER`
- `EMPLOYEE`

O middleware `authGuard` valida o JWT e popula `req.user`. O middleware `requireRoles(...allowed)` restringe os endpoints por papel.

## Padrões de resposta

### `ApiResponse`

Envelope base com:

- `status`
- `message`
- `data`
- `token`
- `timestamp`
- `path`

### `PagedResponse`

Usado em listagens paginadas. Dentro de `data` retorna:

- `currentPage`
- `totalPages`
- `totalElements`
- `limit`
- `content`
- `stats` opcional

## Tratamento de erros

### Middleware global

O `errorMiddleware` retorna:

- status vindo de `err.status` quando disponível
- mensagem de `err.message`
- envelope `ApiResponse.error(...)`

### Comportamento real no projeto

Nem todos os erros chegam ao middleware global. Alguns controllers retornam diretamente `400` em `catch`, usando um payload simples sem o envelope padrão.

## Auditoria simples

Não existe um subsistema formal de auditoria no código atual, mas há auditoria leve por campos.

Mecânica:

- `withAuditData(userId, data, isUpdate)`
- em criação: preenche `createdById` e `updatedById`
- em atualização: preenche `updatedById`

## Tratamento especial de datas

O cliente Prisma é estendido em `src/config/prisma-client.ts` para detectar campos `DateTime @db.Date` e convertê-los de `Date` para string `YYYY-MM-DD` nos resultados.

Benefício:

- reduz ambiguidades de timezone na serialização de datas sem horário

## Logging

Há dois estilos de log coexistindo:

- logs HTTP via `morgan("dev")`
- logs de domínio via `winston` em `src/utils/logger.ts`

O nível `debug` é habilitado quando `DEBUG_LOGS=true`.

## Conclusão arquitetural

A aplicação segue uma arquitetura modular clara e pragmática, adequada para uma API de negócio de médio porte. O desenho predominante é consistente, mas há flexibilizações importantes:

- services por vezes acessam Prisma diretamente
- tratamento de erro não é 100% uniforme
- alguns fluxos administrativos de usuários coexistem em mais de um módulo
