# PrismaFlow API

## Objetivo

Esta pasta resume a implementação atual da `prismaflow-api`, focando no que está no código hoje: arquitetura, módulos, fluxo de requisição, modelo de dados, endpoints e configuração.

## Escopo

Inclui:

- arquitetura e padrões principais
- módulos e responsabilidades
- fluxo HTTP até Prisma
- schema Prisma e regras de domínio
- endpoints expostos
- variáveis de ambiente e decisões operacionais

Não inclui:

- setup local
- build
- testes

## Ordem de leitura

1. `1-ARCHITECTURE.md`
2. `2-MODULES.md`
3. `3-REQUEST_FLOW.md`
4. `4-DATA_MODEL.md`
5. `5-ENDPOINTS_AND_RULES.md`
6. `6-ENV_AND_CONFIGURATION.md`

## Resumo executivo

A API é um backend multi-tenant para gestão de óticas, com suporte a:

- autenticação e usuários
- tenants e filiais
- marcas, produtos e serviços ópticos
- clientes e prescrições
- vendas
- pagamentos e parcelas
- despesas
- dashboard

O padrão predominante é:

`route -> controller -> service -> repository -> Prisma`

Os pontos mais importantes observados no código atual são:

- isolamento por `tenantId`
- uso frequente de `branchId` como contexto operacional
- DTOs com `class-validator` e `class-transformer`
- respostas via `ApiResponse` e `PagedResponse`
- trilha simples de auditoria com `createdById` e `updatedById`
- datas `@db.Date` serializadas como `YYYY-MM-DD` no Prisma estendido
- vendas e pagamentos concentram a lógica mais complexa

## Validações confirmadas no código

- `Brand` usa `@@unique([tenantId, name])`
- `Expense.dueDate` e `Expense.paymentDate` usam `@db.Date`
- `ItemProduct` e `ItemOpticalService` persistem `unitPrice`
- `Payment` possui `subtotal`, `discount` e `total`
- o JWT usa o segredo centralizado em `env.JWT_SECRET`
