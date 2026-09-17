# Documentação — Migração Ótica Cristã

**Projeto:** Migração de dados do sistema legado para a aplicação atual

**Período:** `08-2026`

**Diretório:** `migrations/oticacrista/08-2026/`

**ORM:** Prisma

**Banco atual:** MySQL

**Origem dos dados:** Microsoft Access → XLSX → CSV

**Estratégia:** migração incremental, tabela por tabela

---

# 1. Problema que estamos resolvendo

O sistema atual possui uma estrutura de banco de dados diferente da estrutura utilizada pelo sistema legado.

O cenário é:

```
SISTEMA LEGADO
    │
    └── Microsoft Access (.accdb)
            │
            └── tabelas antigas
                    │
                    └── XLSX
                          │
                          └── CSV
                                │
                                ▼
                        SISTEMA ATUAL
                            │
                            └── Prisma
                                  │
                                  └── MySQL
```

O banco de produção já possui dados e **não pode simplesmente ser apagado ou substituído**.

Além disso, os dados antigos apresentam algumas inconsistências decorrentes de problemas existentes no sistema legado.

Portanto, o objetivo não é simplesmente fazer um `INSERT` de tudo.

Precisamos:

1. Ler os dados antigos.
2. Converter a estrutura antiga para a estrutura atual.
3. Verificar se cada registro antigo já existe na base atual.
4. Caso exista, reutilizar o registro atual.
5. Caso não exista, criar um novo registro.
6. Manter o relacionamento entre os registros através de mapeamentos de IDs.
7. Registrar dados inconsistentes que não puderem ser migrados automaticamente.
8. Evitar alterar ou prejudicar os dados existentes em produção.

---

# 2. Método adotado para resolução

A estratégia definida foi uma **migração incremental por entidade/tabela**.

Em vez de tentar migrar todo o banco de uma vez:

```
Access
   ↓
Todas as tabelas
   ↓
Banco novo
```

faremos:

```
Brand
  ↓
Product
  ↓
Client
  ↓
Prescription
  ↓
Sale
  ↓
Payment
  ↓
...
```

Cada etapa é validada antes de avançar para a próxima.

## 2.1. Por que migrar tabela por tabela?

Porque existem relacionamentos entre as entidades.

Por exemplo:

```
Client
   │
   ├── Prescription
   │
   └── Sale
          │
          └── Payment
```

Se o cliente antigo possui:

```
cliPessoa = 123
```

mas no banco novo esse cliente passa a ser:

```
Client.id = 584
```

as tabelas dependentes precisam saber que:

```
123 → 584
```

Por isso utilizamos arquivos de **mapping**.

---

# 3. Estratégia de mapping de IDs

O banco legado possui IDs próprios.

O banco novo possui IDs próprios.

Não podemos assumir que:

```
ID antigo = ID novo
```

Portanto, para cada entidade migrada é criado um mapeamento:

```
old_id,new_id,status,old_name,new_name
1,335,EXISTING,Sem Marca,SEM MARCA
2,2,EXISTING,JEAN MONIER,JEAN MONIER
3,334,EXISTING,JEAN PIERRE,JEAN PIERRE
4,4,CREATED,PLATINI,PLATINI
5,5,EXISTING,COROLLA,COROLLA
6,6,CREATED,OPTIMAX,OPTIMAX
7,7,EXISTING,BURGUESE,BURGUESE
```

Isso permite que as tabelas futuras consigam reconstruir os relacionamentos.

Exemplo:

```
Venda antiga
clientId = 123
```

Durante a migração:

```
03-client-mapping.csv

123,584
```

Então a venda será criada usando:

```
clientId = 584
```

e não `123`.

---

# 4. Padrão de arquitetura utilizado em `migrations/oticacrista/08-2026`

A estrutura adotada separa as responsabilidades da migração.

Estrutura conceitual:

```
migrations/
└── oticacrista/
    └── 08-2026/
        ├── loaders/
        ├── converters/
        ├── mapping/
        └── reports/
	        └──errors
	        └──executions
	        └──mappings
```

E os scripts de execução ficam numerados:

```
01-brand.ts
02-product.ts
03-client.ts
04-...
```

A numeração representa a **ordem de dependência da migração**.

---

## 4.1. `loaders/`

Responsabilidade:

> Ler os arquivos de origem.
> 

Exemplo:

```
loaders/
├── brand.loader.ts
├── product.loader.ts
├── pessoa.loader.ts
└── pesCliente.loader.ts
```

O loader não deve decidir regras de negócio.

Ele apenas transforma:

```
CSV
   ↓
objetos JavaScript/TypeScript
```

Por exemplo:

```
{pesId:123,pesNome:"JOÃO DA SILVA",pesDoc:"123.456.789-00"
}
```

---

# 4.2. `converters/`

Responsabilidade:

> Converter a estrutura antiga para o modelo utilizado pela aplicação atual.
> 

Exemplo:

```
sistema antigo
      ↓
converter
      ↓
modelo Client
```

O converter deve cuidar de coisas como:

- normalização de CPF;
- normalização de telefone;
- conversão de datas;
- conversão de sexo;
- conversão de campos antigos para novos;
- tratamento de valores vazios;
- transformação de dados textuais.

Ele não deve ser responsável por executar `prisma.create()`.

---

# 4.3. `mapping/`

Responsabilidade:

> Guardar a relação entre os IDs antigos e os IDs atuais.
> 

Exemplo:

```
mapping/
├── brand.mapping.csv
├── product.mapping.csv
└── client.mapping.csv
```

O padrão definido também protege o arquivo final contra migrações incompletas.

A ideia é:

```
migração começa
      ↓
mapping temporário
      ↓
processamento
      ↓
sem erros
      ↓
renomeia para mapping definitivo
```

Caso existam erros:

```
migração começa
      ↓
mapping temporário
      ↓
processamento
      ↓
erros
      ↓
mapping definitivo NÃO é substituído
```

Isso evita considerar uma migração parcialmente executada como concluída.

---

# 4.4. `reports/`

Responsabilidade:

> Registrar problemas e informações sobre cada execução.
> 

Foi definido o uso de:

```
reports/
├── errors/
└── executions/
└── mappings/
```

### `errors/`

Registra registros que não puderam ser migrados ou apresentaram inconsistências.

Exemplo conceitual:

```
reports/errors/client-2026-08-....json
```

### `executions/`

Registra o resumo da execução.

Exemplo:

```
{
  "migration": "02-product",
  "tenantId": "cmibvcyed00007m0118rkgft8",
  "dryRun": false,
  "startedAt": "2026-09-16T02:49:19.345Z",
  "finishedAt": "2026-09-16T02:52:35.623Z",
  "durationMs": 196278,
  "total": 787,
  "created": 350,
  "existing": 433,
  "pending": 4,
  "errors": 0,
  "mappingSaved": true
}
```

O objetivo é conseguir responder:

> O que aconteceu nessa execução?
> 

sem precisar analisar o terminal manualmente.

---

### `mappings/`

arquivos csv que registram a correspondência de id entre os dados do sistema antigo e do novo.

Exemplo:

 `migrations\oticacrista\08-2026\reports\mappings\01-brand-mapping.csv`

```
old_id,new_id,status,old_name,new_name
1,335,EXISTING,Sem Marca,SEM MARCA
2,2,EXISTING,JEAN MONIER,JEAN MONIER
3,334,EXISTING,JEAN PIERRE,JEAN PIERRE
4,4,EXISTING,PLATINI,PLATINI
5,5,EXISTING,COROLLA,COROLLA
6,6,EXISTING,OPTIMAX,OPTIMAX
7,7,EXISTING,BURGUESE,BURGUESE
8,8,EXISTING,MAXLINE,MAXLINE
9,9,EXISTING,PIERRE CARDIN,PIERRE CARDIN
10,10,EXISTING,FOX,FOX
11,11,EXISTING,IMOLA,IMOLA
12,12,EXISTING,LAVORATO,LAVORATO
```

O objetivo é conseguir responder:

> a que entidade no sistema novo corresponde a fk dessa tabela?
> 

---

# 5. DRY_RUN

Adotamos o conceito:

```
DRY_RUN=true
```

para simular a migração.

E:

```
DRY_RUN=false
```

para realizar a criação efetiva.

## DRY_RUN=true

Não altera o banco.

Serve para verificar:

- quantidade de registros;
- registros existentes;
- registros que seriam criados;
- registros pendentes;
- erros;
- regras de matching;
- conversões.

Exemplo:

```
[1/787] Produto X
→ EXISTING
```

ou:

```
[2/787] Produto Y
→ CREATE
```

## DRY_RUN=false

Executa efetivamente:

```
prisma.model.create(...)
```

e obtém o ID real criado.

Esse ID é então utilizado no mapping.

---

# 6. Regra importante do DRY_RUN

Foi identificado um ponto importante durante a discussão:

O `DRY_RUN` deve simular **o mesmo fluxo lógico da execução real**.

A diferença deve ser apenas:

```
DRY_RUN=true
    → não grava

DRY_RUN=false
    → grava
```

Não devemos ter uma lógica completamente diferente para o dry-run.

Isso evita a situação de:

```
DRY_RUN
→ tudo parece correto

EXECUÇÃO REAL
→ comportamento diferente
```

---

# 7. Regras de negócio já definidas

Algumas regras foram identificadas durante a análise do sistema.

## 7.1. Venda

Foi definido:

```
sale.total = sale.subtotal - sale.discount
```

Portanto:

```
subtotal
   -
desconto
   =
total
```

---

## 7.2. Pagamento

Foi definido:

```
payment.subtotal = sale.total
```

e:

```
payment.total = payment.subtotal - payment.discount
```

Ou seja:

```
sale.total
    ↓
payment.subtotal
    ↓
- payment.discount
    ↓
payment.total
```

Essas regras são importantes porque os dados antigos possuem campos financeiros que precisam ser convertidos para o modelo atual.

---

# 8. Estratégia para dados inconsistentes

O sistema legado possui registros inconsistentes.

A estratégia escolhida foi **não travar toda a migração por causa de poucos registros problemáticos**.

Em vez disso:

```
Registro válido
    ↓
migra

Registro inconsistente
    ↓
registra problema
    ↓
continua migração
```

O objetivo é:

> Migrar o máximo possível automaticamente e separar os casos que precisam de análise manual.
> 

Isso é especialmente importante considerando que existem milhares de registros.

---

# 9. O que já foi feito

## 9.1. Banco Access

Foi descoberto como acessar as tabelas que estavam ocultas no `.accdb`.

O sistema legado escondia as tabelas através das configurações do Access/VBA.

Foi possível:

1. abrir o Access;
2. acessar o VBA;
3. localizar o mecanismo utilizado para ocultar as tabelas;
4. corrigir o problema encontrado;
5. exibir as tabelas;
6. acessar os dados necessários.

Esse foi o primeiro passo para conseguir extrair os dados.

---

### 9.2. Conversão XLSX → CSV

Depois foi criado um projeto Node.js para converter os arquivos:

```
input/
   ├── tabela1.xlsx
   ├── tabela2.xlsx
   └── tabela3.xlsx
```

para:

```
output/
   ├── tabela1.csv
   ├── tabela2.csv
   └── tabela3.csv
```

A utilização de CSV foi escolhida porque facilita:

- processamento em Node;
- leitura incremental;
- inspeção dos dados;
- versionamento;
- debugging;
- criação dos scripts de migração.

---

### 9.3 Migração de Brand

A primeira entidade migrada foi `Brand`.

Essa migração foi concluída com sucesso.

Ela serviu também como referência para o padrão dos próximos scripts.

---

### 9.4 Migração de Product

A migração de produtos também foi implementada e testada em `DRY_RUN`.

Resultado obtido:

```
Total:    787
Created:  371
Existing: 412
Pending:  4
Errors:   0
```

Portanto:

```
787 registros analisados

371 → seriam criados
412 → já existem
4   → precisam de análise
0   → erros
```

Esse resultado mostrou que o mecanismo de identificação e conversão estava funcionando para produtos.

---

# 10. Por que o mapping não foi alterado no DRY_RUN

Foi discutido especificamente o fato de o mapping não poder utilizar IDs reais durante:

```
DRY_RUN=true
```

Isso ocorre porque o ID de um registro novo só existe depois que o banco executa:

```
prisma.create()
```

Por exemplo:

```
DRY_RUN

Produto antigo:
id = 500

CREATE
```

Ainda não sabemos se o banco dará:

```
newId = 900
```

ou:

```
newId = 901
```

Portanto, o mapping definitivo deve ser criado na execução real.

Para registros já existentes, porém, o ID atual pode ser conhecido.

---