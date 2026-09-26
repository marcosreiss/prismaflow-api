# Decisões e Regras — Ótica Cristã

## Sumário
- [Decisões e Regras — Ótica Cristã](#decisões-e-regras--ótica-cristã)
  - [Sumário](#sumário)
  - [Estratégia de mapping de IDs](#estratégia-de-mapping-de-ids)
  - [Por que o mapping não é alterado em DRY\_RUN](#por-que-o-mapping-não-é-alterado-em-dry_run)
  - [Estratégia para dados inconsistentes](#estratégia-para-dados-inconsistentes)
  - [Regras de negócio — Venda](#regras-de-negócio--venda)
  - [Regras de negócio — Pagamento](#regras-de-negócio--pagamento)

Este documento reúne decisões arquiteturais e regras de negócio **específicas da migração do tenant `oticacrista`**, complementando o padrão geral descrito em [`migrations/README.md`](../../README.md) e o contexto do tenant em [`../README.md`](../README.md). Novos trechos de decisão podem ser adicionados aqui como novas seções, sem necessidade de renumeração.

## Estratégia de mapping de IDs

O banco legado e o banco novo têm IDs próprios e independentes — não se pode assumir `ID antigo = ID novo`. Por isso, cada entidade migrada gera um arquivo de mapping relacionando os dois IDs, no formato `old_id,new_id,status,old_name,new_name`:

```
old_id,new_id,status,old_name,new_name
1,335,EXISTING,Sem Marca,SEM MARCA
2,2,EXISTING,JEAN MONIER,JEAN MONIER
4,4,CREATED,PLATINI,PLATINI
```

Entidades futuras usam esse mapping para reconstruir relacionamentos. Exemplo: uma venda antiga com `clientId = 123` é resolvida via `client-mapping.csv` (`123 → 584`) e a venda é criada no banco novo já com `clientId = 584`, nunca com o ID antigo.

## Por que o mapping não é alterado em DRY_RUN

O ID de um registro novo só existe depois que o Prisma executa o `create()` de fato — em `DRY_RUN=true` não há garantia de qual ID o banco vai gerar. Por isso o mapping definitivo só é gravado na execução real (`DRY_RUN=false`).

Para registros classificados como `EXISTING` (já existentes no banco atual), o ID já é conhecido de antemão e pode aparecer mesmo durante o dry-run — a restrição vale especificamente para os registros que seriam `CREATED`.

## Estratégia para dados inconsistentes

O sistema legado tem registros inconsistentes. A decisão foi **não travar a migração inteira por poucos registros problemáticos**, dado que existem milhares de registros:

```
registro válido        → migra
registro inconsistente → registra o problema e segue para o próximo
```

O objetivo é migrar automaticamente o máximo possível e isolar apenas os casos que realmente precisam de análise manual (ver reports de erro no padrão geral).

## Regras de negócio — Venda

```
sale.total = sale.subtotal - sale.discount
```

O total da venda é sempre o subtotal menos o desconto — essa regra precisa ser respeitada ao converter os campos financeiros do sistema legado para o modelo `Sale` atual.

## Regras de negócio — Pagamento

```
payment.subtotal = sale.total
payment.total = payment.subtotal - payment.discount
```

O subtotal do pagamento herda o total da venda; o total do pagamento é o subtotal menos o desconto do pagamento:

```
sale.total → payment.subtotal → (- payment.discount) → payment.total
```

Essas regras existem porque os campos financeiros do sistema legado não mapeiam 1:1 para o modelo atual e precisam ser recalculados durante a conversão.
