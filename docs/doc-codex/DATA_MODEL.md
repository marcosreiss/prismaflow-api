# Modelo de Dados

## Visão geral do schema

O modelo de dados está definido em `prisma/schema.prisma` e usa:

- `provider = "mysql"`
- `generator prisma-client-js`

O schema representa uma aplicação multi-tenant para operação de ótica, cobrindo cadastro, vendas, financeiro e dashboard.

## Princípios estruturais do modelo

### 1. Multi-tenant por chave explícita

Quase todos os modelos de domínio possuem `tenantId`.

### 2. Segmentação operacional por filial

Muitos modelos também carregam `branchId`.

### 3. Auditoria simplificada

Diversos modelos possuem:

- `createdById`
- `updatedById`
- `createdAt`
- `updatedAt`

### 4. Soft delete parcial

Muitos modelos possuem `isActive`, mas isso não é universal nem sempre é filtrado automaticamente em todas as consultas.

## Entidades principais

## Tenant

Representa a ótica ou organização principal.

Relações:

- `branches`
- `brands`
- `Client`
- `frameDetails`
- `itemOpticalServices`
- `itemProducts`
- `OpticalService`
- `payments`
- `Prescription`
- `products`
- `protocols`
- `sales`
- `users`
- `paymentMethodItems`
- `paymentInstallments`
- `expenses`

## Branch

Representa uma filial do tenant.

Campos principais:

- `id`
- `name`
- `tenantId`

Constraint importante:

- `@@unique([tenantId, name], name: "branch_name_per_tenant_unique")`

## User

Representa um usuário autenticável do sistema.

Campos principais:

- `id`
- `name`
- `email` globalmente único
- `password`
- `role`
- `tenantId`
- `branchId` opcional

Observações:

- `branchId` opcional é fundamental para o fluxo de seleção de filial do administrador
- `email` é único globalmente, não por tenant

## Brand

Representa marca de produto.

Campos principais:

- `id` autoincrement
- `name`
- `isActive`
- `tenantId`

Observação relevante:

- `name` está com `@unique` global
- isso é mais restritivo do que a validação no service, que trata duplicidade no tenant

## Product

Representa item comercializável de catálogo.

Campos principais:

- `name`
- `description`
- `costPrice`
- `markup`
- `salePrice`
- `stockQuantity`
- `minimumStock`
- `category`
- `tenantId`
- `branchId` opcional
- `brandId` opcional

Implicações:

- estoque é controlado diretamente no produto
- produtos vendidos são copiados na venda apenas por relação, não por snapshot completo

## OpticalService

Representa serviço óptico vendido em uma venda.

Campos principais:

- `name`
- `description`
- `price`
- `tenantId`
- `branchId`

## Client

Representa o cliente da ótica.

Campos relevantes:

- `cpf`
- `bornDate @db.Date`
- `gender`
- dados de contato e endereço
- `tenantId`
- `branchId`

Constraint importante:

- `@@unique([cpf, tenantId])`

Significado:

- um mesmo CPF pode existir em tenants diferentes
- dentro do mesmo tenant, CPF não pode se repetir

## Prescription

Representa a prescrição óptica do cliente.

Campos principais:

- `clientId`
- `prescriptionDate @db.Date`
- `doctorName`
- `crm`
- campos ópticos de longe
- campos ópticos de perto
- películas
- campos gerais
- `tenantId`
- `branchId`

## Sale

Representa uma venda.

Campos principais:

- `clientId`
- `saleDate @db.Date`
- `prescriptionId` opcional
- `subtotal`
- `discount`
- `total`
- `notes`
- `isActive`
- `tenantId`
- `branchId`

Relações:

- pertence a `Client`
- pode referenciar `Prescription`
- possui `serviceItems`
- possui `productItems`
- possui um `payment`
- possui um `protocol`

## ItemProduct

Representa um item de produto dentro da venda.

Campos principais:

- `saleId`
- `productId`
- `quantity`
- `tenantId`
- `branchId`

Observação:

- a quantidade padrão é `1`
- não há preço unitário persistido diretamente no item

## FrameDetails

Representa detalhes adicionais para item de produto quando o produto é uma armação.

Campos principais:

- `itemProductId`
- `material`
- `reference`
- `color`
- `tenantId`
- `branchId`

Constraint:

- `itemProductId` é `@unique`

## ItemOpticalService

Representa um item de serviço dentro da venda.

Campos principais:

- `saleId`
- `serviceId`
- `tenantId`
- `branchId`

## Payment

Representa o agregado financeiro principal da venda.

Campos principais:

- `saleId` único
- `status`
- `total`
- `discount`
- `paidAmount`
- `installmentsPaid`
- `lastPaymentAt @db.Date`
- `isActive`
- `tenantId`
- `branchId`

Constraint importante:

- `saleId @unique`

Consequência:

- cada venda possui no máximo um payment

## Protocol

Representa protocolo complementar da venda.

Campos principais:

- `saleId` opcional e único
- `book`
- `page`
- `os`
- `tenantId`
- `branchId`

Observação:

- o DTO ainda contém `recordNumber`, mas esse campo não existe no schema atual

## PaymentMethodItem

Representa um método de pagamento componente do payment.

Campos principais:

- `paymentId`
- `method`
- `amount`
- `installments`
- `firstDueDate @db.Date`
- `isPaid`
- `paidAt @db.Date`
- `tenantId`
- `branchId`

Uso de domínio:

- permite pagamento composto, por exemplo PIX + parcelado
- métodos instantâneos e métodos parcelados coexistem no mesmo agregado

## PaymentInstallment

Representa cada parcela gerada a partir de um `PaymentMethodItem` parcelado.

Campos principais:

- `paymentMethodItemId`
- `sequence`
- `amount`
- `paidAmount`
- `dueDate @db.Date`
- `paidAt @db.Date`
- `isActive`
- `tenantId`
- `branchId`

Uso de domínio:

- suporta pagamento parcial por parcela
- o status global do payment é recalculado a partir dessas parcelas

## Expense

Representa despesa operacional.

Campos principais:

- `description`
- `amount`
- `dueDate`
- `status`
- `paymentDate`
- `paymentMethod`
- `tenantId`
- `branchId`

Observação:

- `dueDate` e `paymentDate` não estão anotados com `@db.Date` no schema

## Enums do domínio

## `Role`

- `ADMIN`
- `MANAGER`
- `EMPLOYEE`

## `ProductCategory`

- `FRAME`
- `LENS`
- `ACCESSORY`

## `Gender`

- `MALE`
- `FEMALE`
- `OTHER`

## `FrameMaterialType`

- `ACETATE`
- `METAL`
- `RIMLESS`
- `NYLON`
- `TITANIUM`
- `WOOD`
- `OTHERS`

## `PaymentMethod`

- `PIX`
- `MONEY`
- `DEBIT`
- `CREDIT`
- `INSTALLMENT`

## `PaymentStatus`

- `PENDING`
- `CONFIRMED`
- `CANCELED`

## `ExpenseStatus`

- `SCHEDULED`
- `PAID`

## Relações mais importantes do domínio

- `Tenant -> Branch`: um tenant possui muitas filiais
- `Tenant -> User`: um tenant possui muitos usuários
- `Client -> Prescription`: um cliente possui várias prescrições
- `Client -> Sale`: um cliente possui várias vendas
- `Sale -> Payment`: uma venda possui no máximo um pagamento
- `Sale -> Protocol`: uma venda possui no máximo um protocolo
- `Sale -> ItemProduct / ItemOpticalService`: uma venda possui múltiplos itens
- `Payment -> PaymentMethodItem`: um pagamento possui vários métodos
- `PaymentMethodItem -> PaymentInstallment`: um método parcelado possui várias parcelas

## Particularidades relevantes do modelo

### Datas sem horário

O projeto trata vários campos de data como `@db.Date`, o que é coerente com:

- data de nascimento
- data da prescrição
- data da venda
- vencimentos e quitações financeiras

### Inconsistências de modelo/código

Há alguns sinais de desalinhamento histórico:

- `Protocol` no schema não tem `recordNumber`, mas o DTO e o service de vendas ainda lidam com ele
- `Brand.name` é globalmente único, embora o service valide por tenant
- nem toda entidade com `isActive` é filtrada automaticamente nas consultas

### Integridade de pagamento depende da aplicação

O banco modela a estrutura, mas parte da consistência financeira depende do código:

- soma dos métodos deve bater com o total
- soma das parcelas deve bater com o método
- confirmação do payment depende do recálculo em service

## Resumo do agregado de negócio central

O agregado mais importante do sistema é:

`Client -> Prescription? -> Sale -> Payment -> PaymentMethodItem -> PaymentInstallment`
