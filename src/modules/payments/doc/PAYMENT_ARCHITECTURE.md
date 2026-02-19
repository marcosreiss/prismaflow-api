# Payment Module — Architecture

Descrição detalhada de cada arquivo do módulo, suas responsabilidades e dependências.

---

## Repository Layer

Única camada com acesso direto ao Prisma. Nenhum service deve importar `prisma` diretamente,
exceto `payment-update.service.ts` que utiliza `prisma.$transaction` para operações atômicas.

### `payment.repository.ts`
Responsável por todas as queries do model `Payment`.

| Método | Descrição |
|---|---|
| `create` | Cria um Payment com include completo de `methods` e `installmentItems` |
| `update` | Atualiza um Payment e retorna com include completo |
| `findById` | Busca Payment por ID com `sale`, `methods` e `installmentItems` |
| `findBySaleId` | Busca Payment pelo `saleId` com `methods` e `installmentItems` |
| `softDelete` | Marca `isActive: false` sem deletar fisicamente |
| `findAllByTenant` | Listagem paginada com filtros: `status`, `method`, `clientId`, `clientName`, `hasOverdueInstallments`, `isPartiallyPaid`, `dueDaysAhead` |

### `payment-method-item.repository.ts`
Responsável por todas as queries do model `PaymentMethodItem`.

| Método | Descrição |
|---|---|
| `create` | Cria um PaymentMethodItem vinculado a um Payment |
| `update` | Atualiza campos de um PaymentMethodItem |
| `findById` | Busca por ID com `installmentItems` |
| `findByPaymentId` | Lista todos os métodos de um Payment |
| `delete` | Delete físico de um método (usado após validação de parcelas pagas) |
| `deleteByPaymentId` | Delete físico de todos os métodos de um Payment |

> **Nota:** delete físico é intencional — métodos sem parcelas pagas podem ser removidos
> no fluxo de replace do `PUT /payments/:id`.

### `payment-installment.repository.ts`
Responsável por todas as queries do model `PaymentInstallment`.

| Método | Descrição |
|---|---|
| `create` | Cria uma parcela vinculada a um `paymentMethodItemId` |
| `update` | Atualiza dados de uma parcela (paidAmount, paidAt, dueDate, etc.) |
| `findById` | Busca por ID com include de `paymentMethodItem` e `payment` |
| `findByMethodItemId` | Lista parcelas de um método específico ordenadas por `sequence` |
| `softDelete` | Marca `isActive: false` |
| `deleteByMethodItemId` | Delete físico de todas as parcelas de um método |
| `findOverdue` | Lista parcelas vencidas (`dueDate < now`, `paidAt: null`, `isActive: true`) paginadas com dados de cliente |

---

## Service Layer

### `payment.service.ts`
Operações simples de leitura e criação. Não contém lógica de negócio complexa.

**Depende de:** `PaymentRepository`, `PaymentIntegrityService`

| Método | Descrição |
|---|---|
| `findAll` | Lista pagamentos paginados com enriquecimento: `hasOverdueInstallments`, `overdueCount`, `nextDueDate`, `nextDueAmount` |
| `findById` | Busca e retorna payment com todos os métodos e parcelas |
| `findStatusBySaleId` | Retorna apenas `status`, `paymentId` e `saleId` |
| `create` | Cria Payment, valida soma dos métodos e gera parcelas para métodos parcelados |
| `delete` | Soft delete — apenas payments com status `PENDING` |

### `payment-update.service.ts`
Contém a lógica mais complexa do módulo. Centraliza atualização, mudança de status e validação de integridade.

**Depende de:** `PaymentRepository`, `PaymentMethodItemRepository`, `PaymentInstallmentRepository`, `PaymentIntegrityService`, `prisma` (somente para `$transaction`)

| Método | Descrição |
|---|---|
| `update` | Replace completo de `methods[]`: remove antigos, cria novos e gera parcelas — tudo validado. Bloqueia se houver parcelas pagas |
| `updateStatus` | Transições de status com regras: CONFIRMED não pode voltar a PENDING, CANCELED não pode ser modificado. Confirmação manual consolida `paidAmount` |
| `validate` | Endpoint público que executa `validatePaymentIntegrity` e retorna estatísticas detalhadas |

> **Particularidade:** o replace de métodos usa `prisma.$transaction` para garantir atomicidade —
> se a criação de algum método falhar, toda a operação é revertida.

### `payment-integrity.service.ts`
Service utilitário compartilhado. Não expõe rotas — é consumido internamente por outros services.

**Depende de:** `PaymentRepository`, `PaymentInstallmentRepository`

| Método | Descrição |
|---|---|
| `generateInstallments` | Gera parcelas mensais (intervalos de 30 dias) para um `PaymentMethodItem` parcelado. Executa `validateMethodItemIntegrity` após geração |
| `validateMethodItemIntegrity` | Valida sequência contínua e presença de `dueDate` nas parcelas de um método |
| `validatePaymentIntegrity` | Validação completa: soma dos métodos === `payment.total`, integridade de cada método parcelado, soma das parcelas === `amount` do método |
| `recalculatePaymentStatus` | Achata `methods[].installmentItems[]`, recalcula `installmentsPaid`, `paidAmount`, `lastPaymentAt` e `status` do Payment |

### `payment-method-item.service.ts`
Gerencia adição, edição e remoção pontual de métodos em um Payment existente.
Utilizado quando o front precisa de ajustes cirúrgicos sem reenviar o array completo.

**Depende de:** `PaymentRepository`, `PaymentMethodItemRepository`, `PaymentInstallmentRepository`, `PaymentIntegrityService`

| Método | Descrição |
|---|---|
| `create` | Adiciona um método a um Payment existente e gera parcelas se parcelado |
| `update` | Atualiza dados do método — bloqueado se houver parcelas pagas |
| `delete` | Remove método e suas parcelas — bloqueado se houver parcelas pagas |

### `payment-installment.service.ts`
Leitura e edição de parcelas. Não registra pagamentos — responsabilidade do `PaymentInstallmentPayService`.

**Depende de:** `PaymentRepository`, `PaymentInstallmentRepository`

| Método | Descrição |
|---|---|
| `findByPaymentId` | Achata parcelas de todos os métodos, enriquece com `isPaid`, `isOverdue`, `daysOverdue`, `remainingAmount` e retorna resumo |
| `findById` | Busca parcela por ID com enriquecimento |
| `update` | Atualiza `amount`, `dueDate` ou `sequence` — bloqueado se `paidAmount > 0`. Valida que soma das parcelas do método não diverge do `amount` do método |
| `findOverdue` | Lista parcelas vencidas com estatísticas: `totalAmount`, `averageDaysOverdue` |

### `payment-installment-pay.service.ts`
Responsável exclusivamente pelo registro de pagamento de uma parcela.

**Depende de:** `PaymentInstallmentRepository`, `PaymentIntegrityService`

| Método | Descrição |
|---|---|
| `payInstallment` | Valida saldo restante, acumula `paidAmount`, marca `paidAt` apenas quando totalmente quitada, dispara `recalculatePaymentStatus` |

---

## Controller Layer

### `payment.controller.ts`
Handlers para `PaymentService`, `PaymentUpdateService` e `PaymentMethodItemService`.
Instancia os três services e delega cada requisição ao método correspondente.

### `payment-installment.controller.ts`
Handlers para `PaymentInstallmentService` e `PaymentInstallmentPayService`.
Separa leitura/edição de parcelas do registro de pagamento.

Ambos os controllers seguem o mesmo padrão:
```typescript
try {
  const result = await service.method(req);
  res.status(result.status || 200).json(result);
} catch (error: any) {
  handleError(res, error, "Mensagem de fallback.");
}
```

---

## Routes Layer

### `payment.routes.ts` → prefixo `/payments`
Rotas do Payment. Ordem de declaração:
1. Rotas estáticas (`/`, `/by-sale/:saleId`)
2. Subrotas específicas de `/:id` (`/:id/validate`, `/:id/status`)
3. Rotas genéricas de `/:id` (`GET`, `PUT`, `DELETE`)

### `payment-installment.routes.ts` → prefixo `/payment-installments`
Rotas de PaymentInstallment. Ordem de declaração:
1. Estáticas: `/overdue`, `/by-payment/:paymentId`
2. Genéricas: `/:id` (GET, PUT), `/:id/pay` (PATCH)

> **Importante:** as rotas de installments vivem em prefixo próprio (`/payment-installments`)
> para evitar colisão com as rotas genéricas `/:id` de `/payments`.

---

## Diagrama de Dependências

```
payment.controller.ts
    ├── payment.service.ts
    │       └── payment-integrity.service.ts
    ├── payment-update.service.ts
    │       └── payment-integrity.service.ts
    └── payment-method-item.service.ts
            └── payment-integrity.service.ts

payment-installment.controller.ts
    ├── payment-installment.service.ts
    └── payment-installment-pay.service.ts
            └── payment-integrity.service.ts

payment-integrity.service.ts  (utilitário compartilhado)
    ├── payment.repository.ts
    └── payment-installment.repository.ts
```
