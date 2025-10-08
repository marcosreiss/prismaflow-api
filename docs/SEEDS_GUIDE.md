# 🌱 **Seeds — PrismaFlow API**

Este módulo de **seeds** popula o banco de dados (`prismaflowdb`) com dados iniciais para desenvolvimento e testes.

O sistema foi projetado para ser **idempotente**:

> ou seja, pode ser executado quantas vezes quiser sem duplicar dados.
> 

---

## 📂 **Estrutura de pastas**

```
prisma/
 ├─ schema.prisma              → modelo do banco
 └─ seeds/
     ├─ seed-tenant.ts         → cria o tenant principal
     ├─ seed-branches.ts       → cria a filial (branch)
     ├─ seed-users.ts          → cria o usuário admin
     ├─ seed-brands.ts         → cria marcas
     ├─ seed-products.ts       → cria produtos de teste
     ├─ seed-optical-services.ts → cria serviços óticos
     ├─ seed-clients.ts        → cria clientes
     ├─ seed-prescriptions.ts  → cria receitas
     └─ index.ts               → executa todos os seeds em sequência

```

---

## ⚙️ **Como funciona**

Cada arquivo de seed:

- Usa o **Prisma Client** para acessar o banco.
- Executa um `findFirst` para verificar se o registro já existe.
- Cria o registro **apenas se não existir**.
- Imprime logs descritivos no console.

Exemplo simplificado (padrão usado em todos os seeds):

```tsx
const existing = await prisma.client.findFirst({
  where: { name: "Cliente 1" },
});

if (!existing) {
  await prisma.client.create({ data: { name: "Cliente 1" } });
  console.log("✅ Cliente criado");
} else {
  console.log("⚠️ Cliente já existe, pulando...");
}

```

---

## 🚀 **Como rodar o seed**

### 1️⃣ Comando disponível

No `package.json`, o script já está configurado:

```json
"scripts": {
  "seed": "ts-node prisma/seeds/index.ts"
}

```

### 2️⃣ Executar o seed completo

```bash
npm run seed

```

👉 Isso cria (ou reaproveita) os dados básicos:

- Tenant, Branch, Usuário admin
- Marcas, Produtos, Serviços
- Clientes e Receitas (Prescriptions)

---

## 🧩 **Rodar seeds individuais**

Você também pode executar um script isolado, por exemplo só o de clientes:

```bash
npx ts-node prisma/seeds/seed-clients.ts

```

Ou o de receitas:

```bash
npx ts-node prisma/seeds/seed-prescriptions.ts

```

Esses scripts podem rodar de forma independente — úteis para gerar dados adicionais depois do primeiro seed.

---

## ➕ **Como adicionar novos seeds**

Para criar uma nova entidade de seed (ex: `Sale`), siga o padrão abaixo:

1. **Crie o arquivo** em `prisma/seeds/seed-sales.ts`:
    
    ```tsx
    import { PrismaClient } from "@prisma/client";
    const prisma = new PrismaClient();
    
    export async function seedSales(tenantId: string, branchId: string) {
      const clients = await prisma.client.findMany({ take: 3 });
    
      for (const client of clients) {
        const existingSale = await prisma.sale.findFirst({
          where: { clientId: client.id },
        });
    
        if (existingSale) continue;
    
        await prisma.sale.create({
          data: {
            clientId: client.id,
            tenantId,
            branchId,
            subtotal: 300,
            discount: 20,
            total: 280,
            notes: "Venda de teste",
          },
        });
      }
    
      console.log("💰 Vendas criadas com sucesso!");
    }
    
    ```
    
2. **Importe e execute no `index.ts`:**
    
    ```tsx
    import { seedSales } from "./seed-sales";
    ...
    await seedSales(tenant.id, branch.id);
    
    ```
    
3. **Rode novamente:**
    
    ```bash
    npm run seed
    
    ```
    

O novo seed será incluído automaticamente na sequência.

---

## 🔄 **Como gerar mais registros**

Se quiser **criar mais registros** (ex: mais produtos, receitas, etc.),

basta:

1. Alterar o seed respectivo (por exemplo, aumentar o `take` ou o loop `Array.from({ length: N })`).
2. Rodar novamente `npm run seed`.

Como os seeds usam `findFirst` para evitar duplicações, se quiser forçar novos registros:

- altere os nomes (ex: `Produto ${i + 10}`)
- ou apague manualmente os registros do banco antes de rodar novamente.

---

## ✅ **Resumo**

| Ação | Comando |
| --- | --- |
| Rodar todos os seeds | `npm run seed` |
| Rodar seed individual | `npx ts-node prisma/seeds/seed-<nome>.ts` |
| Adicionar novo seed | Criar arquivo + importar no `index.ts` |
| Regenerar dados | Alterar valores e rodar novamente |

---

## 💬 Dica profissional

Durante o desenvolvimento, você pode automatizar o seed para rodar **após `prisma migrate dev`**, adicionando no `package.json`:

```json
"prisma": {
  "seed": "ts-node prisma/seeds/index.ts"
}

```

Assim, o comando padrão também funciona:

```bash
npx prisma db seed

```
