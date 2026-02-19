# Payment Module — Flows

Fluxos detalhados com exemplos de payload, regras de negócio e casos de erro.

---

## 1. Fluxo Completo de uma Venda com Pagamento

### Passo 1 — Criar a venda
O `SaleService` cria automaticamente um `Payment` vazio vinculado à venda.
O front não precisa fazer nenhuma chamada adicional neste momento.

```
POST /sales
→ Sale criada
→ Payment criado automaticamente com status PENDING e total zerado
```

### Passo 2 — Configurar o pagamento
O front envia `PUT /payments/:id` com os métodos e o total:

**Exemplo: entrada em PIX + parcelado em 3x**
```json
PUT /payments/42
{
  "total": 450.00,
  "discount": 0,
  "methods": [
    {
      "method": "PIX",
      "amount": 100.00
    },
    {
      "method": "INSTALLMENT",
      "amount": 350.00,
      "installments": 3,
      "firstDueDate": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

O sistema executa em sequência:
1. Valida `soma(methods[].amount) === total` (tolerância de R$ 0,01)
2. Dentro de uma `$transaction`: remove métodos e parcelas antigos, cria novos métodos
3. Gera parcelas para o método `INSTALLMENT`:
   - Parcela 1: R$ 116,67 — venc. 01/03/2026
   - Parcela 2: R$ 116,67 — venc. 31/03/2026
   - Parcela 3: R$ 116,67 — venc. 30/04/2026
4. Executa `validateMethodItemIntegrity` após geração
5. Retorna o Payment completo com `methods` e `installmentItems`

**Exemplo: pagamento à vista em dinheiro**
```json
PUT /payments/42
{
  "total": 450.00,
  "discount": 50.00,
  "methods": [
    { "method": "MONEY", "amount": 400.00 }
  ]
}
```

### Passo 3 — Registrar pagamento de parcela
```json
PATCH /payment-installments/15/pay
{
  "paidAmount": 116.67
}
```

O sistema:
1. Valida que `paidAmount <= remainingAmount`
2. Acumula `paidAmount` na parcela
3. Marca `paidAt` apenas quando `paidAmount >= amount` (quitação total)
4. Dispara `recalculatePaymentStatus`:
   - Achata todas as parcelas de todos os métodos
   - Recalcula `installmentsPaid`, `paidAmount` e `lastPaymentAt` do Payment
   - Se todas as parcelas estiverem com `paidAt != null` → `status = CONFIRMED`

---

## 2. Regras de Negócio

### Validações no PUT /payments/:id

| Condição | Comportamento |
|---|---|
| `status = CANCELED` | Bloqueia qualquer atualização |
| `status = CONFIRMED` e `data.status !== CANCELED` | Permite apenas alterar `status` |
| Alguma parcela com `paidAt != null` | Bloqueia alteração de `methods[]` |
| `soma(methods[].amount) !== total` | Retorna erro 400 |
| Método `INSTALLMENT` sem `firstDueDate` | Retorna erro 400 |

### Validações no PATCH /payment-installments/:id/pay

| Condição | Comportamento |
|---|---|
| `paidAt != null` | Parcela já quitada — bloqueia |
| `paidAmount > remainingAmount` | Valor excede saldo — bloqueia |
| Pagamento parcial | Acumula `paidAmount`, **não** marca `paidAt` |
| Pagamento total | Acumula `paidAmount` e marca `paidAt = now()` (ou `paidAt` informado) |

### Transições de Status

```
PENDING ──► CONFIRMED   (automático ao quitar todas as parcelas, ou manual via PATCH /:id/status)
PENDING ──► CANCELED    (manual via PATCH /:id/status)
CONFIRMED ──► CANCELED  (manual via PATCH /:id/status, com reason opcional)
CONFIRMED ──► PENDING   ❌ não permitido
CANCELED ──► qualquer   ❌ não permitido
```

---

## 3. Endpoint de Validação de Integridade

```
GET /payments/:id/validate
```

Executa verificações em cadeia e retorna estatísticas:

```json
{
  "valid": true,
  "stats": {
    "paymentId": 42,
    "saleId": 10,
    "status": "PENDING",
    "total": 450.00,
    "discount": 0,
    "methodsCount": 2,
    "sumMethods": 450.00,
    "installmentsCreated": 3,
    "installmentsPaid": 0,
    "paidAmount": 0
  },
  "methods": [
    {
      "id": 1,
      "method": "PIX",
      "amount": 100.00,
      "installments": null,
      "installmentItems": []
    },
    {
      "id": 2,
      "method": "INSTALLMENT",
      "amount": 350.00,
      "installments": 3,
      "installmentItems": [
        { "id": 15, "sequence": 1, "amount": 116.67, "paidAmount": 0, "dueDate": "2026-03-01", "isPaid": false },
        { "id": 16, "sequence": 2, "amount": 116.67, "paidAmount": 0, "dueDate": "2026-03-31", "isPaid": false },
        { "id": 17, "sequence": 3, "amount": 116.67, "paidAmount": 0, "dueDate": "2026-04-30", "isPaid": false }
      ]
    }
  ]
}
```

**Verificações realizadas:**
1. Payment possui ao menos um método cadastrado
2. `soma(methods[].amount) === payment.total` (tolerância R$ 0,01)
3. Para cada método parcelado: sequência contínua sem lacunas
4. Para cada método parcelado: todas as parcelas possuem `dueDate`
5. Para cada método parcelado: `soma(installmentItems[].amount) === method.amount`

---

## 4. Listagem com Filtros

```
GET /payments?status=PENDING&method=INSTALLMENT&hasOverdueInstallments=true&page=1&limit=10
```

**Filtros disponíveis:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `status` | `PENDING \| CONFIRMED \| CANCELED` | Status do Payment |
| `method` | `PaymentMethod` | Filtra payments que possuem este método |
| `startDate` | `Date` | Criados a partir desta data |
| `endDate` | `Date` | Criados até esta data |
| `clientId` | `number` | ID do cliente da venda |
| `clientName` | `string` | Nome parcial do cliente (contains) |
| `hasOverdueInstallments` | `boolean` | Possui parcelas vencidas não pagas |
| `isPartiallyPaid` | `boolean` | `installmentsPaid > 0` e `status = PENDING` |
| `dueDaysAhead` | `number` | Parcelas a vencer nos próximos X dias |
| `page` | `number` | Página (default: 1) |
| `limit` | `number` | Itens por página (default: 10, max: 100) |

Cada item retornado é enriquecido com:
- `hasOverdueInstallments`: boolean
- `overdueCount`: quantidade de parcelas vencidas
- `nextDueDate`: data da próxima parcela a vencer
- `nextDueAmount`: valor da próxima parcela a vencer

---

## 5. Parcelas Vencidas

```
GET /payment-installments/overdue?page=1&limit=10
```

Retorna parcelas com `dueDate < now`, `paidAt = null` e `isActive = true`, ordenadas por `dueDate asc`.

Cada item inclui:
- `daysOverdue`: dias em atraso
- `remainingAmount`: saldo devedor
- `clientName`: nome do cliente
- `clientPhone`: telefone principal do cliente

Resposta inclui estatísticas globais:
```json
{
  "stats": {
    "totalOverdue": 12,
    "totalAmount": 1450.00,
    "averageDaysOverdue": 18
  }
}
```

---

## 6. Casos de Erro Comuns

| Situação | Status | Mensagem |
|---|---|---|
| Payment não encontrado | 404 | "Pagamento não encontrado." |
| Tenant diferente | 403 | "Você não tem permissão para acessar este pagamento." |
| Payment cancelado | 400 | "Não é possível atualizar um pagamento cancelado." |
| Parcelas pagas, tentativa de alterar métodos | 400 | "Não é possível alterar os métodos de pagamento quando já existem parcelas pagas." |
| Soma dos métodos diverge do total | 400 | "A soma dos métodos (R$ X) deve ser igual ao total (R$ Y)." |
| Método parcelado sem firstDueDate | 400 | "O método INSTALLMENT é parcelado mas não possui firstDueDate." |
| Parcela já quitada | 400 | "Esta parcela já foi paga completamente." |
| Valor pago excede saldo | 400 | "O valor pago (X) não pode ser maior que o valor restante da parcela (Y)." |
| Delete de payment não-PENDING | 400 | "Somente pagamentos com status PENDING podem ser excluídos." |
| Reabrir payment CONFIRMED | 400 | "Não é possível reabrir um pagamento já confirmado." |
