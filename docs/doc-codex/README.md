# PrismaFlow API

## Objetivo desta documentação

Esta pasta consolida a documentação técnica da API `prismaflow-api` com base na implementação atual do projeto Node.js usando Express, Prisma e MySQL. O foco aqui é descrever a aplicação como ela está hoje no código, não como ela idealmente deveria estar.

Esta documentação cobre:

- visão geral e arquitetura da aplicação
- organização de módulos e responsabilidades por camada
- fluxo de requisição do Express até o Prisma
- modelo de dados do Prisma, entidades, enums e relações
- endpoints expostos e principais regras de negócio
- variáveis de ambiente e decisões de configuração

Não cobre:

- instruções de execução local
- build
- testes

## Estrutura dos documentos

- `ARCHITECTURE.md`: visão geral da aplicação, bootstrap, arquitetura lógica e padrões transversais
- `MODULES.md`: organização por módulo e responsabilidade de controllers, services, repositories, DTOs e middlewares
- `REQUEST_FLOW.md`: fluxo de requisição HTTP, autenticação, validação, resposta e exemplos ponta a ponta
- `DATA_MODEL.md`: documentação detalhada do schema Prisma, entidades, enums, relacionamentos e implicações de domínio
- `ENDPOINTS_AND_RULES.md`: catálogo de endpoints e principais regras de negócio associadas
- `ENV_AND_CONFIGURATION.md`: variáveis de ambiente, configuração do Prisma, aliases TypeScript, logging e comportamento operacional

## Resumo executivo

A API implementa um backend multi-tenant voltado ao domínio de óticas, com suporte a:

- autenticação e gestão de usuários
- tenants e filiais
- marcas, produtos e serviços ópticos
- clientes e prescrições
- vendas com itens de produto e serviço
- pagamentos com múltiplos métodos e parcelamento
- despesas
- indicadores de dashboard

O isolamento principal entre dados é feito por `tenantId`, com uso adicional frequente de `branchId` para segmentação operacional por filial. O controle de acesso é baseado em JWT com papéis `ADMIN`, `MANAGER` e `EMPLOYEE`.

## Características arquiteturais observadas

- O projeto adota, como padrão predominante, a cadeia `route -> controller -> service -> repository -> Prisma`.
- Esse padrão não é absolutamente rígido: há services que também acessam `prisma` diretamente, principalmente nos fluxos mais complexos de vendas e pagamentos.
- A API utiliza DTOs com `class-validator` e `class-transformer` para validação de `body`, `query` e `params`.
- As respostas seguem majoritariamente um envelope comum (`ApiResponse` e `PagedResponse`).
- Os dados do banco usam `createdById` e `updatedById` como trilha simples de auditoria, preenchidos por `withAuditData`.
- Campos `DateTime @db.Date` do Prisma são convertidos para string `YYYY-MM-DD` na camada de cliente Prisma estendido.

## Observações importantes sobre fidelidade ao código

Alguns pontos relevantes da implementação atual:

- existe uma pasta histórica `docs/` no projeto, mas esta documentação nova foi criada em `doc-codex/` conforme solicitado
- `AuthService.registerUser` e o módulo `users` coexistem e tratam criação de usuários por caminhos diferentes
- o módulo de pagamentos tem a arquitetura mais elaborada do projeto, com múltiplos services especializados
- o módulo de vendas concentra lógica relevante de estoque, itens, protocolo e pagamento inicial
- o tratamento de erros não é totalmente uniforme entre todos os controllers

Para leitura sequencial, a ordem recomendada é:

1. `ARCHITECTURE.md`
2. `MODULES.md`
3. `REQUEST_FLOW.md`
4. `DATA_MODEL.md`
5. `ENDPOINTS_AND_RULES.md`
6. `ENV_AND_CONFIGURATION.md`
