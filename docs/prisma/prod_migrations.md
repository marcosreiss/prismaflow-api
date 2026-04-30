# Guia de Migração Manual com Prisma

Este documento define o **processo oficial** para realizar **alterações no banco de dados usando Prisma**, de forma **manual, segura e compatível com produção (Linux + MySQL)**.

> Objetivo: evitar problemas com shadow database, case‑sensitivity e perda de dados.
> 

---

## ✅ Quando usar este fluxo

Use **migração manual** quando:

- O banco de produção é **MySQL em Linux**
- O usuário **não tem permissão de CREATE DATABASE**
- Você **não pode usar `prisma migrate dev` em produção**
- Precisa de **controle total do SQL executado**

---

## ❌ O que NÃO fazer em produção

- ❌ `npx prisma migrate dev`
- ❌ `npx prisma db pull` sem necessidade
- ❌ `npx prisma migrate reset`
- ❌ Dar permissão de `CREATE DATABASE` ao usuário de produção

---

## 🧩 FLUXO PADRÃO — MIGRAÇÃO MANUAL

### 1️⃣ Ajustar o `schema.prisma`

Faça a alteração desejada **somente no schema**.

Exemplo (remover coluna):

```
model Protocol {
  id        Int @id @default(autoincrement())
  // campo removido aqui
}

```

> ⚠️ O schema sempre representa o estado final desejado.
> 

---

### 2️⃣ Criar a migration manual

### 2.1 Criar a pasta

```
prisma/migrations/YYYYMMDD_descricao_da_migration/

```

Exemplo:

```
prisma/migrations/20260117_remove-record-number-from-protocol/migration.sql

```

---

### 2.2 Criar `migration.sql`

Escreva **apenas o SQL necessário**, com **case exato das tabelas de produção**:

```sql
-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)

ALTER TABLE `Protocol`
DROP COLUMN `recordNumber`;

```

> ✔ Sempre usar o nome real da tabela em produção
> 

---

### 3️⃣ Validar antes de aplicar (opcional, recomendado)

No banco alvo:

```sql
SHOW COLUMNS FROM Protocol;

```

Confirme que:

- A coluna existe
- Não há dependências (FK, índice, etc.)

---

### 4️⃣ Aplicar a migration

Apontando o `.env` para o banco desejado:

```bash
npx prisma migrate deploy

```

✔ Executa apenas o SQL

✔ Não cria shadow DB

✔ Não altera histórico incorretamente

---

### 5️⃣ Validar após aplicar

```sql
SHOW COLUMNS FROM Protocol;

```

Confirme que a alteração foi aplicada.

---

### 6️⃣ Prisma Client

| Situação | Rodar `prisma generate`? |
| --- | --- |
| Schema mudou | ✅ Sim |
| Só aplicou migration | ❌ Não necessário |

---

## 🧪 Banco local (Windows)

Para aplicar a mesma migration localmente:

```bash
npx prisma migrate deploy

```

> ✔ MySQL no Windows é case‑insensitive
> 
> 
> ✔ `Protocol` / `protocol` funcionam
> 

---

## 🧠 Regras de Ouro

- O **schema.prisma é a fonte da verdade**
- Produção usa **apenas `migrate deploy`**
- Migrations **sempre versionadas no Git**
- Nunca corrigir drift apagando banco

---

## 📌 Checklist rápido

- [ ]  Schema atualizado
- [ ]  Pasta de migration criada
- [ ]  SQL validado com case correto
- [ ]  `migrate deploy` executado
- [ ]  Banco validado

---

## 📎 Observação final

Migração manual **não é gambiarra** — é prática comum em ambientes profissionais com controle e segurança.

---