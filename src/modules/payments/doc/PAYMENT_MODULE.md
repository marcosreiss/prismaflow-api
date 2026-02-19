# Payment Module — Overview

## Propósito

O módulo de pagamentos gerencia todo o ciclo financeiro de uma venda (`Sale`), desde a criação do pagamento até o registro de parcelas individuais. Suporta **múltiplos métodos de pagamento por venda** (ex: entrada em PIX + restante parcelado em crédito), resultado de uma migração realizada em 19/02/2026.

---

## Estrutura de Pastas

```
src/modules/payments/
├── controller/
│   ├── payment.controller.ts               # Handlers de Payment e PaymentMethodItem
│   └── payment-installment.controller.ts   # Handlers de PaymentInstallment
├── dtos/
│   ├── payment.dto.ts                      # DTOs de criação, atualização e filtros de Payment
│   └── payment-installment.dto.ts          # DTOs de parcelas e registro de pagamento
├── repository/
│   ├── payment.repository.ts               # Queries de Payment (CRUD + listagem/filtros)
│   ├── payment-method-item.repository.ts   # Queries de PaymentMethodItem
│   └── payment-installment.repository.ts   # Queries de PaymentInstallment + vencidas
├── routes/
│   ├── payment.routes.ts                   # Rotas /payments
│   └── payment-installment.routes.ts       # Rotas /payment-installments
└── services/
    ├── payment.service.ts                  # Listagem, busca, criação e delete de Payment
    ├── payment-update.service.ts           # Atualização, status e validação de integridade
    ├── payment-method-item.service.ts      # CRUD de métodos (uso interno e pontual)
    ├── payment-integrity.service.ts        # Geração de parcelas, validação e recálculo de status
    ├── payment-installment.service.ts      # Leitura e atualização de parcelas
    └── payment-installment-pay.service.ts  # Registro de pagamento de parcela
```

---

## Modelo de Dados

```
Sale 1:1 ──► Payment
                ├── total: Float
                ├── discount: Float
                ├── paidAmount: Float
                ├── installmentsPaid: Int
                ├── status: PENDING | CONFIRMED | CANCELED
                └── methods: PaymentMethodItem[]
                        ├── method: PIX | MONEY | DEBIT | CREDIT | INSTALLMENT
                        ├── amount: Float
                        ├── installments?: Int
                        ├── firstDueDate?: DateTime
                        └── installmentItems: PaymentInstallment[]
                                ├── sequence: Int
                                ├── amount: Float
                                ├── paidAmount: Float
                                ├── dueDate?: DateTime
                                └── paidAt?: DateTime
```

---

## Fluxo Principal (visão do front-end)

### 1. Criação da venda
O `SaleService` cria automaticamente um `Payment` vazio vinculado à venda. Nenhuma ação necessária do front neste momento.

### 2. Configurar o pagamento
O front envia um único `PUT /payments/:id` com os métodos desejados:

```json
{
  "total": 450.00,
  "discount": 0,
  "methods": [
    { "method": "PIX", "amount": 100.00 },
    { "method": "INSTALLMENT", "amount": 350.00, "installments": 3, "firstDueDate": "2026-03-01T00:00:00.000Z" }
  ]
}
```

O sistema automaticamente:
- Remove métodos e parcelas anteriores (se não houver parcelas pagas)
- Cria os novos `PaymentMethodItem`
- Gera as `PaymentInstallment` para métodos parcelados

### 3. Registrar pagamento de parcela
```
PATCH /payment-installments/:id/pay
{ "paidAmount": 116.67 }
```

O sistema recalcula automaticamente `paidAmount`, `installmentsPaid` e `status` do `Payment`.

### 4. Status final
Quando todas as parcelas de todos os métodos forem pagas, o `Payment.status` é atualizado para `CONFIRMED` automaticamente.

---

## Prefixos de Rota

| Prefixo                  | Responsabilidade                        |
|--------------------------|-----------------------------------------|
| `POST /payments`          | Criar payment manualmente               |
| `GET /payments`           | Listar com filtros e paginação          |
| `GET /payments/:id`       | Buscar payment por ID                   |
| `PUT /payments/:id`       | Atualizar payment e métodos             |
| `DELETE /payments/:id`    | Soft delete (apenas PENDING)            |
| `PATCH /payments/:id/status` | Atualizar status manualmente         |
| `GET /payments/:id/validate` | Validar integridade do payment       |
| `GET /payments/by-sale/:saleId` | Buscar status por saleId          |
| `GET /payment-installments/overdue` | Parcelas vencidas paginadas  |
| `GET /payment-installments/by-payment/:paymentId` | Parcelas de um payment |
| `GET /payment-installments/:id` | Buscar parcela por ID            |
| `PUT /payment-installments/:id` | Atualizar parcela (sem pagamento registrado) |
| `PATCH /payment-installments/:id/pay` | Registrar pagamento de parcela |

---

## Particularidades

- **Multi-tenant**: todos os recursos são isolados por `tenantId` extraído do JWT
- **Alias `@/`**: todos os imports usam o alias `@/` apontando para `src/`
- **Prisma restrito à camada repository**: nenhum service acessa o Prisma diretamente, exceto `payment-update.service.ts` que usa `prisma.$transaction` para o replace atômico de métodos
- **Geração de parcelas**: intervalos mensais fixos de 30 dias a partir de `firstDueDate`
- **`paidAt`**: marcado apenas quando a parcela é **totalmente quitada** (`paidAmount >= amount`)
- **Soft delete**: `Payment` e `PaymentInstallment` usam `isActive: false` — nunca são deletados fisicamente, exceto no replace de métodos via transaction
