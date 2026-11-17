# Decisões e Regras — Ótica Cristã

## Sumário
- [Decisões e Regras — Ótica Cristã](#decisões-e-regras--ótica-cristã)
  - [Sumário](#sumário)
  - [Estratégia de mapping de IDs](#estratégia-de-mapping-de-ids)
  - [Por que o mapping não é alterado em DRY\_RUN](#por-que-o-mapping-não-é-alterado-em-dry_run)
  - [Estratégia para dados inconsistentes](#estratégia-para-dados-inconsistentes)
  - [Regras de negócio — Venda](#regras-de-negócio--venda)
  - [Regras de negócio — Pagamento](#regras-de-negócio--pagamento)
  - [Padronização dos arquivos e caminhos nos Reports](#padronização-dos-arquivos-e-caminhos-nos-reports)

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
sale.subtotal = SUM(itemTotalParcial × itemQtd)
sale.total = atendimento.ateTotal
sale.discount = sale.subtotal - sale.total
sale.total = sale.subtotal - sale.discount
```

O valor unitário do item vem de `itemTotalParcial`; o subtotal de cada linha multiplica esse valor por `itemQtd`. Os cálculos são feitos em centavos inteiros e representados com duas casas decimais. Se o total legado superar o subtotal calculado, o desconto seria negativo e o atendimento fica pendente.

Todas as observações `itemObs` são associadas ao produto legado e preservadas em `Sale.notes`, inclusive valores vazios e repetidos. O campo é `TEXT`; validar o limite em bytes UTF-8, sem truncar conteúdo. Qualquer pendência bloqueia a migração completa antes da persistência.

Vendas e itens são persistidos em uma transação global. O mapping temporário é preparado com os IDs gerados dentro da transação, mas só é publicado após o commit. Se o commit for confirmado e a publicação falhar, manter o temporário e o manifesto de recuperação; uma nova execução deve parar até a recuperação ou reconciliação.

Depois que `sale-mapping.csv` existe, o runner bloqueia uma nova migração para evitar criar vendas duplicadas, pois o modelo atual não possui um campo de origem legado nem foi definida uma chave segura para localizar uma venda legada já persistida.

## Regras de negócio — Pagamento

```
payment.subtotal = sale.total
payment.total = payment.subtotal - payment.discount
```

O subtotal do pagamento herda o total da venda; o total do pagamento é o subtotal menos o desconto do pagamento:

```
sale.total → payment.subtotal → (- payment.discount) → payment.total
```


---

## Padronização dos arquivos e caminhos nos Reports

Todos os **nomes de arquivos, diretórios, prefixos e identificadores estruturais específicos da entidade** devem ser declarados no início do arquivo `.report.ts`.

Isso evita strings espalhadas pela implementação e facilita futuras alterações de nomenclatura ou estrutura.

Exemplo:

```tsx
const ENTITY = "brand";
const ENTITY_ORDER = "01";

const ERRORS_DIR_NAME = "errors";
const EXECUTIONS_DIR_NAME = "executions";

const MAPPINGS_DIR = path.resolve(
    process.cwd(),
    "migrations/oticacrista/reports/mappings"
);

const MAPPING_FILE_NAME =
    `${ENTITY_ORDER}-${ENTITY}-mapping.csv`;

const ERROR_FILE_PREFIX =
    `${ENTITY_ORDER}-${ENTITY}-error`;

const EXECUTION_FILE_PREFIX =
    `${ENTITY_ORDER}-${ENTITY}-execution`;
```

A lógica do report deve utilizar essas constantes, evitando valores como:

```
"01-brand-mapping.csv"
"01-brand-error-..."
"01-brand-execution-..."
"reports/mappings"
```

espalhados pelo código.

`Regra`

> **Configurações estruturais ficam no topo do arquivo; a implementação utiliza essas configurações sem repetir os caminhos ou nomes diretamente.**
> 

Essa padronização deve ser aplicada a todas as entidades futuras.
