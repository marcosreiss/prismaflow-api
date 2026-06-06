# Modelo de Dados

## Visão geral

O schema está em `prisma/schema.prisma` e usa:

- `provider = "mysql"`
- `generator prisma-client-js`

O modelo cobre cadastro, vendas, financeiro e dashboard em cenário multi-tenant.

## Princípios estruturais

- isolamento por `tenantId`
- segmentação por `branchId`
- auditoria simples com `createdById` e `updatedById`
- `softDelete` seletivo via `isActive`

## Entidades centrais

### Tenant

Entidade raiz do sistema. Relaciona filiais, usuários, catálogo, clientes, vendas, pagamentos e despesas.

### Branch

Filial do tenant.

Constraint principal:

- `@@unique([tenantId, name])`

### User

Usuário autenticável com `email` globalmente único, `role`, `tenantId` e `branchId` opcional.

### Brand

Marca de produto.

Constraint principal:

- `@@unique([tenantId, name])`

### Product

Produto vendável com preços, estoque, categoria, `tenantId`, `branchId` e `brandId`.

### OpticalService

Serviço óptico vendável, sempre vinculado a tenant e filial.

### Client

Cliente da ótica.

Constraint principal:

- `@@unique([cpf, tenantId])`

### Prescription

Receita/prescrição do cliente, com `prescriptionDate @db.Date` e vários campos ópticos.

### Sale

Venda principal do domínio, com:

- `saleDate @db.Date`
- `subtotal`
- `discount`
- `total`
- `tenantId`
- `branchId`

Relaciona cliente, prescrição opcional, itens, payment e protocolo.

### ItemProduct

Item de produto da venda com `productId`, `quantity`, `unitPrice`, `tenantId` e `branchId`.

### FrameDetails

Detalhes adicionais de armação.

Constraint:

- `itemProductId @unique`

### ItemOpticalService

Item de serviço da venda com `serviceId`, `unitPrice`, `tenantId` e `branchId`.

### Payment

Agregado financeiro da venda, com:

- `saleId @unique`
- `status`
- `subtotal`
- `discount`
- `total`
- `paidAmount`
- `installmentsPaid`
- `lastPaymentAt @db.Date`

### Protocol

Protocolo complementar da venda.

Observação:

- o schema não possui `recordNumber`

### PaymentMethodItem

Método de pagamento componente do payment, com `method`, `amount`, `installments`, `firstDueDate @db.Date`, `isPaid` e `paidAt @db.Date`.

### PaymentInstallment

Parcela gerada para método `INSTALLMENT`, com `sequence`, `amount`, `paidAmount`, `dueDate @db.Date` e `paidAt @db.Date`.

### Expense

Despesa operacional com `dueDate @db.Date`, `paymentDate @db.Date`, `paymentMethod`, `tenantId` e `branchId`.

## Enums

### `Role`

- `ADMIN`
- `MANAGER`
- `EMPLOYEE`

### `ProductCategory`

- `FRAME`
- `LENS`
- `ACCESSORY`

### `Gender`

- `MALE`
- `FEMALE`
- `OTHER`

### `FrameMaterialType`

- `ACETATE`
- `METAL`
- `RIMLESS`
- `NYLON`
- `TITANIUM`
- `WOOD`
- `OTHERS`

### `PaymentMethod`

- `PIX`
- `MONEY`
- `DEBIT`
- `CREDIT`
- `INSTALLMENT`

### `PaymentStatus`

- `PENDING`
- `CONFIRMED`
- `CANCELED`

### `ExpenseStatus`

- `SCHEDULED`
- `PAID`

## Agregado central

`Client -> Prescription? -> Sale -> Payment -> PaymentMethodItem -> PaymentInstallment`
