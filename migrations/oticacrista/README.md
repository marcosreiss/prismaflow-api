# Migração — Ótica Cristã

## Sumário
- [Migração — Ótica Cristã](#migração--ótica-cristã)
  - [Sumário](#sumário)
  - [Contexto](#contexto)
  - [Problema resolvido](#problema-resolvido)
  - [Origem e destino dos dados](#origem-e-destino-dos-dados)
  - [Planejamento por fase](#planejamento-por-fase)
  - [Status atual](#status-atual)
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

| Origem (legado)        | Destino (atual)    |
| ---------------------- | ------------------ |
| Branch                 | Branch             |
| Brand                  | Brand              |
| Product (tipo produto) | Product            |
| Product (tipo serviço) | OpticalService     |
| pessoa + pesCliente    | Client             |
| atendimento            | Sale               |
| itensAtendimento       | Items              |
| carne                  | PaymentInstallment |
| —                      | PaymentMethodItem  |
| —                      | Payment            |
| finReceita             | a descobrir        |
| finDespesa             | a descobrir        |
| —                      | Prescription       |
| —                      | FrameDetails       |
| —                      | Protocol           |

## Planejamento por fase

A ordem exata é ajustada conforme os dados forem sendo analisados, mas a sequência de referência é:

**Fase 1 — cadastros básicos:** Branch, Brand, Product (+ Service, extraído do mesmo CSV de produto).

**Fase 2 — clientes:** `pessoa` + `pesCliente` → Client.

**Fase 3 — vendas:** `atendimento` → Sale; `itensAtendimento` → Items.

**Fase 4 — financeiro:** `carne` → PaymentInstallment; PaymentMethodItem; Payment; `finReceita` e `finDespesa` (estrutura ainda a descobrir).

**Fase 5 — informações complementares:** Prescription, FrameDetails, Protocol.

Cada etapa é executada manualmente e validada antes de seguir para a próxima:

```
npm run migration -- -t oticacrista -e brand   → valida
npm run migration -- -t oticacrista -e product → valida
...
```

## Status atual

- **Acesso ao Access:** as tabelas do sistema legado estavam ocultas via configuração VBA. Foi localizado o mecanismo, corrigido, e as tabelas ficaram acessíveis para extração.
- **Conversão XLSX → CSV:** projeto Node.js criado para converter os arquivos de `input/*.xlsx` para `output/*.csv`. CSV foi escolhido por facilitar processamento incremental em Node, inspeção manual, versionamento e debugging.
- **Brand:** migração concluída (`migrations/oticacrista/brand/`). Serviu de referência de padrão para as próximas entidades.
- **Product:** implementada seguindo o padrão consolidado (`migrations/oticacrista/product/`). Detalhes específicos:
  - o CSV de origem (`produto.csv`) contém tanto produtos quanto serviços (`prodTipo = "SERVICO"`); como o volume de serviços é pequeno e a origem é a mesma, a migração não foi separada em duas entidades — o `product.converter.ts` resolve o destino (`kind: "PRODUCT" | "SERVICE"`) e o orquestrador ramifica o fluxo internamente, gerando `product-mapping.csv` e `service-mapping.csv` separados;
  - a marca é resolvida lendo o mapping de `brand` já finalizado, via `loadMapping` (`shared/mapping.ts`); produto sem marca cai no fallback `old_id = 1` ("SEM MARCA");
  - a categoria (`FRAME`/`LENS`/`ACCESSORY`) é detectada automaticamente por palavras-chave no nome do produto (`product.converter.ts`); quando não é possível detectar, a decisão é feita manualmente via prompt no terminal (`product.matcher.ts`) — e essa pergunta só ocorre depois de confirmado que o produto ainda não existe no banco, para não interromper a migração perguntando sobre registros já migrados;
  - resultado obtido em execução de teste:

```
Total:    787
Created:  371
Existing: 412
Errors:   0
```

- **Client, Sale, Payment e demais entidades:** ainda não iniciadas — seguem o planejamento por fase acima.

## Como executar

Ver seção "Executor central" em [`migrations/README.md`](../README.md). Exemplo para este tenant:

```
npm run migration -- -t oticacrista -e brand
npm run migration -- -t oticacrista -e product
```

Configuração de ambiente do tenant em `migrations/oticacrista/.env` (variáveis `MIGRATION_TENANT_ID`, `MIGRATION_BRANCH_ID`, `MIGRATION_INPUT_DIR`, `MIGRATION_REPORTS_DIR`, `MIGRATION_DRY_RUN`).
</content>
