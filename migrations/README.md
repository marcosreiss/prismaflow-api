# Migrations

## Sumário
- [Migrations](#migrations)
  - [Sumário](#sumário)
  - [Objetivo](#objetivo)
  - [Estrutura geral](#estrutura-geral)
  - [Executor central](#executor-central)
  - [Camada shared](#camada-shared)
  - [Configuração por tenant](#configuração-por-tenant)
  - [DRY RUN](#dry-run)
  - [Fluxo padrão de uma migração](#fluxo-padrão-de-uma-migração)
  - [Responsabilidade dos arquivos por entidade](#responsabilidade-dos-arquivos-por-entidade)
    - [`<entidade>.ts` (orquestrador)](#entidadets-orquestrador)
    - [`.loader.ts`](#loaderts)
    - [`.converter.ts`](#converterts)
    - [`.index.ts`](#indexts)
    - [`.matcher.ts`](#matcherts)
    - [`.persistence.ts`](#persistencets)
    - [`.report.ts`](#reportts)
    - [Critério para criar novos arquivos](#critério-para-criar-novos-arquivos)
  - [Reports, logs, erros e mappings](#reports-logs-erros-e-mappings)
    - [Reports específicos da entidade](#reports-específicos-da-entidade)
    - [Mappings (centralizados por tenant)](#mappings-centralizados-por-tenant)
    - [Logs](#logs)
    - [Erros](#erros)
    - [Execution reports](#execution-reports)
  - [Convenções de nomenclatura](#convenções-de-nomenclatura)
  - [Princípios obrigatórios](#princípios-obrigatórios)

Este documento descreve o padrão **geral** de arquitetura das migrações de dados legadas para a aplicação atual (Prisma + MySQL). Vale para qualquer tenant migrado. Documentação específica de cada tenant (dados, planejamento, decisões pontuais) fica em `migrations/<tenant>/README.md` e `migrations/<tenant>/doc/`.

## Objetivo

Migrar dados de sistemas legados (ex.: Microsoft Access → XLSX → CSV) para o banco atual sem apagar ou substituir dados de produção já existentes.

A abordagem é sempre **incremental, entidade por entidade**, nunca uma migração única de todo o banco. Cada entidade é validada (via `DRY_RUN`) antes de avançar para a próxima, respeitando a ordem de dependência entre elas (ex.: `Brand → Product → Client → Sale → Payment`).

Cada execução deve:
- ler os dados antigos;
- converter a estrutura antiga para a estrutura atual;
- verificar se o registro já existe no banco atual (evitar duplicar);
- criar o registro quando não existir;
- manter o relacionamento entre registros via mapeamento de IDs (antigo → novo);
- registrar inconsistências que não puderem ser migradas automaticamente, sem travar o restante da migração;
- nunca alterar ou prejudicar dados já existentes em produção.

## Estrutura geral

```
migrations/
├── run.ts
└── <tenant>/
    ├── .env
    ├── input/
    ├── README.md
    ├── doc/
    ├── shared/
    │   ├── config.ts
    │   ├── logger.ts
    │   ├── mapping.ts
    │   ├── types.ts
    │   └── utils.ts
    ├── mappings/
    └── <entidade>/
        ├── <entidade>.loader.ts
        ├── <entidade>.converter.ts
        ├── <entidade>.index.ts
        ├── <entidade>.matcher.ts
        ├── <entidade>.persistence.ts
        ├── <entidade>.report.ts
        ├── <entidade>.ts
        └── reports/
            ├── errors/
            └── executions/
```

Nem todos os arquivos específicos da entidade são obrigatórios — devem ser criados conforme a complexidade e a necessidade real da migração (ver [Critério para criar novos arquivos](#responsabilidade-dos-arquivos-por-entidade)).

Os orquestradores (`<entidade>.ts`) e os arquivos de mapping/report **não são numerados** — a ordem de dependência entre entidades já é dada pela pasta de cada uma e pelo planejamento por fase documentado no README do tenant. Não existe `01-brand.ts`, `02-product.ts`; existe `brand/brand.ts`, `product/product.ts`.

## Executor central

A execução de qualquer migração é centralizada em `migrations/run.ts`.

```json
{
  "scripts": {
    "migration": "npx tsx migrations/run.ts"
  }
}
```

Uso padrão:

```
npm run migration -- -t <tenant> -e <entity>
```

Exemplo:

```
npm run migration -- -t oticacrista -e brand
npm run migration -- -t oticacrista -e product
```

O executor recebe o tenant e a entidade, localiza a pasta do tenant, localiza o orquestrador da entidade (`<entidade>/<entidade>.ts`), executa e retorna o código de saída da migração. Isso evita criar um script npm individual para cada entidade.

## Camada shared

Existe uma camada compartilhada por tenant para evitar duplicação entre entidades:

```
<tenant>/shared/
├── config.ts
├── logger.ts
├── mapping.ts
├── types.ts
└── utils.ts
```

- **`config.ts`** — carrega e valida as configurações da migração (o `.env` do tenant: `tenantId`, `branchId`, `inputDir`, `dryRun`). Os módulos não devem acessar `process.env` diretamente.
- **`logger.ts`** — logging da execução. Deve escrever simultaneamente no terminal e em arquivo, com timestamp e nível (`INFO`, `SUCESSO`, `AVISO`, `ERRO`).
- **`mapping.ts`** — utilitário genérico de leitura e escrita de mapping, usado por qualquer entidade:
  - `loadMapping(mappingsDir, entity)` — carrega um mapping já finalizado de outra entidade (ex.: Product lê o mapping de Brand para resolver `brandNewId`), indexado por `oldId`.
  - `createMappingWriter(mappingsDir, entity)` — cria um escritor de mapping incremental (ver [Mappings](#mappings-centralizados-por-tenant)), com `create`, `append`, `finalize` e `discard`.
- **`types.ts`** — tipos compartilhados entre entidades (contexto da migração, `MigrationExecutionReport`, estruturas de erro). Tipos específicos de uma entidade ficam na própria entidade.
- **`utils.ts`** — funções genéricas reutilizáveis (formatação de timestamp, serialização de erros, etc.).

## Configuração por tenant

Cada tenant possui seu próprio `.env`:

```
migrations/<tenant>/.env
```

Exemplo:

```
MIGRATION_TENANT_ID=...
MIGRATION_BRANCH_ID=...

MIGRATION_INPUT_DIR=./migrations/<tenant>/input
MIGRATION_REPORTS_DIR=./migrations/<tenant>/reports

MIGRATION_DRY_RUN=false
```

Variáveis comuns ficam centralizadas nessa configuração — nunca hardcoded (`const TENANT_ID = "..."`, `const DRY_RUN = false`) espalhado pelos scripts.

## DRY RUN

Controlado por `MIGRATION_DRY_RUN` no `.env` do tenant.

- `MIGRATION_DRY_RUN=false` → a migração persiste efetivamente os dados (`prisma.model.create(...)`), obtém o ID real criado e grava no mapping.
- `MIGRATION_DRY_RUN=true` → a migração executa o **mesmo fluxo lógico** da execução real, mas não grava no banco. Continua permitindo leitura, conversão, matching, indexação, validações, identificação de registros existentes, geração de logs e reports.

Regra importante: o `DRY_RUN` não deve ter uma lógica diferente da execução real. A única diferença deve ser a ausência de escrita no banco — isso evita a situação de "no dry-run tudo parece correto, mas na execução real o comportamento é diferente".

Consequência direta: **o mapping definitivo não é criado nem sobrescrito em `DRY_RUN=true`**, porque o ID de um registro novo só existe depois do `prisma.create()` real. Para registros já existentes (`EXISTING`), o ID atual já é conhecido e pode aparecer mesmo em dry-run.

## Fluxo padrão de uma migração

```
Configuração
     ↓
Loader
     ↓
Converter
     ↓
Index
     ↓
Matcher
     ↓
Persistence
     ↓
Mapping
     ↓
Reports
     ↓
Finalização
```

Nem toda entidade passa por todas as etapas. Uma entidade simples pode seguir apenas `Loader → Converter → Persistence → Report`, sem necessidade de indexação ou matching.

## Responsabilidade dos arquivos por entidade

### `<entidade>.ts` (orquestrador)

Coordena o fluxo: inicializa contexto/config, inicializa logger, chama loader, converter, matching/indexação quando necessário, persistência, registra resultados, gera reports finais, desconecta o Prisma.

O orquestrador **não deve conter**: queries Prisma diretas, `fs.writeFileSync`/`readFileSync`, construção de CSV ou JSON de erro, implementação de matching ou de índices, regras de persistência, implementação de logger, caminhos espalhados no código, ou regras específicas que pertencem a outro módulo. Deve ser pequeno e legível — uma sequência clara de etapas.

Quando uma entidade legada se desdobra em mais de um destino (ex.: `produto.csv` gera tanto `Product` quanto `OpticalService`, dependendo do tipo do registro), não é necessário separar em duas migrações completas se a origem dos dados for a mesma e o volume do segundo destino for pequeno — o `.converter.ts` resolve qual é o destino (`kind`) e o orquestrador ramifica o fluxo internamente.

### `.loader.ts`

Lê os dados antigos (localiza o arquivo de entrada, lê CSV/XLSX, interpreta e retorna objetos do modelo antigo). Não consulta Prisma, não cria registros, não faz matching, não gera reports, não aplica regras de persistência.

### `.converter.ts`

Transforma o modelo antigo no modelo usado pelo sistema novo (normalização de CPF, telefone, datas, sexo, campos antigos → novos, valores vazios, dados textuais). Não consulta banco, não cria registros, não gera mapping, não escreve arquivos.

### `.index.ts`

Cria índices em memória (`Map<CPF, Client>`, `Map<OldId, NewEntity>`, etc.) quando o volume ou a complexidade da busca justificar, evitando buscas O(n) repetidas. Só deve existir quando houver necessidade real — não por padrão.

### `.matcher.ts`

Determina a correspondência entre o registro antigo e o registro no sistema novo, quando não existe chave direta ou quando o relacionamento exige múltiplos critérios (ID, nome, CPF, RG, combinações, prioridades, fallback). Não persiste dados.

Também é o lugar correto para decisões que não podem ser resolvidas de forma determinística e exigem confirmação manual no terminal (ex.: categoria de um produto que não foi identificada automaticamente pelo converter) — desde que a pergunta só seja feita quando estritamente necessária (ver nota em `.persistence.ts` sobre ordem de verificação).

### `.persistence.ts`

Concentra toda a interação com o banco: `find`, `findUnique`, `findFirst`, `create`, `update`, `upsert`. O orquestrador nunca executa queries diretamente. A persistência deve sempre respeitar o `DRY_RUN`.

Quando a criação de um registro depende de uma decisão manual custosa (matcher interativo), separar a verificação de existência (`findExisting...`) da criação (`create...`) permite ao orquestrador só acionar o matcher quando o registro for realmente novo — evitando perguntas desnecessárias sobre registros que já existem.

### `.report.ts`

Gera os resultados da migração: mappings, erros, execution reports, serialização e escrita dos arquivos de relatório. Reports de erro/execução específicos da entidade ficam dentro da própria pasta da entidade; o mapping é escrito no diretório centralizado do tenant usando `createMappingWriter` de `shared/mapping.ts` (ver [Mappings](#mappings-centralizados-por-tenant)).

Não deve existir um arquivo `.mapping.ts` próprio por entidade — a leitura/escrita de mapping é sempre feita via `shared/mapping.ts`, para evitar reimplementar a mesma lógica em cada entidade.

### Critério para criar novos arquivos

Não criar arquivos apenas para obedecer à estrutura — cada arquivo deve ter uma responsabilidade clara e necessária. Uma entidade simples pode ter só `loader`, `converter`, `persistence` e `report`. Uma entidade complexa pode ter todos os arquivos, incluindo `index` e `matcher`. O padrão é seguido quando faz sentido, não de forma artificial.

## Reports, logs, erros e mappings

### Reports específicos da entidade

```
migrations/<tenant>/modules/<entidade>/reports/
├── errors/
└── executions/
```

Pertencem exclusivamente à execução daquela entidade. Os logs (terminal + arquivo) são gerados pelo `logger` compartilhado durante a execução, com timestamp e nível.

### Mappings (centralizados por tenant)

```
migrations/<tenant>/mappings/
├── brand-mapping.csv
├── product-mapping.csv
├── service-mapping.csv
└── ...
```

Mappings ficam centralizados diretamente em `<tenant>/mappings/`, **sem** a pasta `reports/` intermediária e **sem** prefixo numérico — ex.: `migrations/oticacrista/mappings/brand-mapping.csv`. Isso porque mappings podem ser reutilizados por entidades futuras — por exemplo, `client-mapping.csv` gerado na migração de clientes é lido depois pela migração de vendas para resolver o `clientId` novo a partir do `clientId` antigo.

Formato do mapping (`old_id,new_id,status[,old_name,new_name]`):

```
old_id,new_id,status,old_name,new_name
1,335,EXISTING,Sem Marca,SEM MARCA
4,4,CREATED,PLATINI,PLATINI
```

Uma entidade pode gerar mais de um mapping quando os dados de origem se desdobram em mais de um destino — por exemplo, `product.ts` gera tanto `product-mapping.csv` quanto `service-mapping.csv`, a partir do mesmo `produto.csv`.

**Escrita incremental.** O padrão adotado é `createMappingWriter` (`shared/mapping.ts`), com quatro operações:
- `create(header)` — cria o arquivo `.tmp` com o cabeçalho, uma vez, antes do loop de processamento (só quando `dryRun = false`);
- `append(row)` — adiciona uma linha por vez, conforme cada registro é processado, direto no `.tmp`;
- `finalize()` — renomeia `.tmp` para o arquivo definitivo, chamado apenas quando a execução termina **sem erros**;
- `discard()` — remove o `.tmp`, chamado quando a execução termina **com erros**, preservando o último mapping definitivo válido.

Esse padrão é mais seguro que gravar tudo de uma vez ao final, porque não depende de manter a lista completa de mappings em memória até o fim e permite recuperar o progresso mesmo que a execução seja interrompida no meio (o `.tmp` nunca substitui o definitivo sozinho).

Em `DRY_RUN=true`, nenhuma dessas operações é chamada pelo orquestrador — o mapping simplesmente não é tocado.

**Leitura de mapping de outra entidade.** Use `loadMapping(mappingsDir, entity)` de `shared/mapping.ts`, que devolve um `Map<oldId, MappingRow>` a partir do CSV definitivo já finalizado. Nunca fazer parsing de CSV manual dentro da entidade que consome o mapping.

### Logs

Gerados pelo `logger` compartilhado (`shared/logger.ts`) durante a execução de cada entidade, com saída simultânea em terminal e arquivo:

```
[10:32:15] [INFO] MIGRAÇÃO INICIADA
[10:32:16] [INFO] Registros encontrados: 787
[10:32:16] [INFO] [EXISTENTE] ...
[10:32:17] [INFO] [CRIADO] ...
[10:32:20] [SUCESSO] MIGRAÇÃO FINALIZADA
```

### Erros

```
<entidade>/reports/errors/
```

Cada erro deve preservar, quando possível: entidade, ID antigo, identificação do registro, momento do erro, nome do erro, mensagem e stack trace. Um erro em um registro não deve interromper toda a migração — a estratégia padrão é registrar o erro e continuar com o próximo, exceto em falhas estruturais que tornem impossível continuar com segurança.

### Execution reports

```
<entidade>/reports/executions/
```

Deve conter, quando aplicável: `entity`, `tenantId`, `dryRun`, `startedAt`, `finishedAt`, `durationMs`, `total`, `created`, `existing`, `errors`. `created` e `existing` ficam sempre no nível raiz (mesmo quando a entidade se desdobra em mais de um destino, como `product`/`service`); o detalhamento por sub-entidade pode ser adicionado como campos extras (ex.: `products: {...}`, `services: {...}`).

Exemplo — entidade simples (`brand`):

```json
{
  "entity": "Brand",
  "tenantId": "cmibvcyed00007m0118rkgft8",
  "dryRun": false,
  "startedAt": "2026-09-16T02:49:19.345Z",
  "finishedAt": "2026-09-16T02:52:35.623Z",
  "durationMs": 196278,
  "total": 787,
  "created": 350,
  "existing": 433,
  "errors": 0
}
```

Exemplo — entidade com sub-destinos (`product`, que também migra `service`):

```json
{
  "entity": "Product",
  "tenantId": "cmibvcyed00007m0118rkgft8",
  "dryRun": false,
  "startedAt": "2026-09-26T21:00:00.000Z",
  "finishedAt": "2026-09-26T21:05:00.000Z",
  "durationMs": 300000,
  "total": 787,
  "created": 371,
  "existing": 412,
  "errors": 0,
  "products": { "created": 350, "existing": 400 },
  "services": { "created": 21, "existing": 12 }
}
```

## Convenções de nomenclatura

```
<entidade>.loader.ts
<entidade>.converter.ts
<entidade>.index.ts
<entidade>.matcher.ts
<entidade>.persistence.ts
<entidade>.report.ts
<entidade>.ts                    (orquestrador, sem numeração)

<entidade>-mapping.csv
<entidade>-execution-<timestamp>.json
<entidade>-error-<identificador>-<timestamp>.json
```

Nem os scripts de execução nem os arquivos de mapping/erro/execução usam prefixo numérico — a ordem de dependência das entidades fica documentada no planejamento por fase do tenant, não no nome do arquivo.

## Princípios obrigatórios

Para qualquer entidade nova, manter:

- orquestrador pequeno, sem query Prisma e sem escrita de arquivo direta;
- separação clara de responsabilidades entre loader, converter, index, matcher, persistence e report;
- configuração centralizada (nunca `process.env` direto nos módulos);
- logger compartilhado, com saída simultânea em terminal e arquivo;
- reports de erro/execução separados por entidade; mappings centralizados em `<tenant>/mappings/`, lidos e escritos exclusivamente via `shared/mapping.ts`;
- `DRY_RUN` respeitado por toda a cadeia, com o mesmo fluxo lógico da execução real;
- index e matcher criados apenas quando realmente necessários;
- decisões manuais assistidas (matcher interativo) só acontecem depois de confirmado que o registro não existe ainda — nunca perguntar sobre um registro já existente;
- erros individuais registrados sem interromper a migração, salvo falha estrutural;
- reutilização de código via `shared/`, sem duplicar funcionalidades genéricas entre entidades;
- preservação dos mappings necessários para manter a integridade das FKs em migrações posteriores;
- nenhuma responsabilidade duplicada entre arquivos (ex.: mapping é responsabilidade única do `.report.ts` + `shared/mapping.ts`).
</content>
