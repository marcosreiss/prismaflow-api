# Migração — Ótica Cristã

## Sumário
- [Migração — Ótica Cristã](#migração--ótica-cristã)
  - [Sumário](#sumário)
  - [Contexto](#contexto)
  - [Problema resolvido](#problema-resolvido)
  - [Origem e destino dos dados](#origem-e-destino-dos-dados)
  - [Planejamento por fase](#planejamento-por-fase)
  - [Como executar](#como-executar)

Este README cobre o que é **específico do tenant `oticacrista`**: contexto do sistema legado, planejamento das fases e status da migração. O padrão geral de arquitetura (estrutura de pastas, DRY_RUN, reports, mappings, convenções) está documentado em [`migrations/README.md`](../README.md) e vale para este tenant sem exceções. Decisões arquiteturais e regras de negócio específicas desta migração estão em [`doc/DECISIONS.md`](./doc/DECISIONS.md).

## Contexto

- **Diretório:** `migrations/oticacrista/`
- **ORM:** Prisma
- **Banco atual:** MySQL
- **Origem dos dados:** Microsoft Access → XLSX → CSV
- **Estratégia:** migração incremental, tabela por tabela

## Problema resolvido

O sistema atual tem uma estrutura de banco diferente do sistema legado, e o banco de produção já possui dados — **não pode ser apagado ou substituído**. Os dados antigos também têm inconsistências herdadas do sistema legado.

Fluxo de origem dos dados:

```
Microsoft Access (.accdb)
    ↓
tabelas antigas
    ↓
XLSX
    ↓
CSV
    ↓
Prisma / MySQL (sistema atual)
```

Por isso a migração não é um `INSERT` direto. Para cada entidade é necessário: ler os dados antigos, converter para a estrutura atual, verificar se o registro já existe no banco atual (reutilizar se existir, criar se não existir), manter os relacionamentos via mapeamento de IDs, registrar inconsistências não migráveis automaticamente, e nunca alterar dados já existentes em produção.

## Origem e destino dos dados

Principais tabelas do sistema legado e para onde migram no sistema atual:

| Origem (legado)     | Destino (atual)    |
| ------------------- | ------------------ |
| Branch              | Branch             |
| Brand               | Brand              |
| Product             | Product            |
| pessoa + pesCliente | Client             |
| atendimento         | Sale               |
| itensAtendimento    | Items              |
| carne               | PaymentInstallment |
| —                   | PaymentMethodItem  |
| —                   | Payment            |
| finReceita          | a descobrir        |
| finDespesa          | a descobrir        |
| —                   | Prescription       |
| —                   | FrameDetails       |
| —                   | Protocol           |

## Planejamento por fase

A ordem exata é ajustada conforme os dados forem sendo analisados, mas a sequência de referência é:

**Fase 1 — cadastros básicos:** Branch, Brand, Product.

**Fase 2 — clientes:** `pessoa` + `pesCliente` → Client.

**Fase 3 — vendas:** `atendimento` → Sale; `itensAtendimento` → Items.

**Fase 4 — financeiro:** `carne` → PaymentInstallment; PaymentMethodItem; Payment; `finReceita` e `finDespesa` (estrutura ainda a descobrir).

**Fase 5 — informações complementares:** Prescription, FrameDetails, Protocol.

---

## Como executar

Ver seção "Executor central" em [`migrations/README.md`](../README.md). Exemplo para este tenant:

```
npm run migration -- -t oticacrista -e brand
npm run migration -- -t oticacrista -e product
```

Configuração de ambiente do tenant em `migrations/oticacrista/.env` (variáveis `MIGRATION_TENANT_ID`, `MIGRATION_BRANCH_ID`, `MIGRATION_INPUT_DIR`, `MIGRATION_REPORTS_DIR`, `MIGRATION_DRY_RUN`).
