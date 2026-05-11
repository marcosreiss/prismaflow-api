# Refatoração do Módulo `payments`

## DTOs

### `payment.dto.ts`

- **`CreatePaymentDto` removido** — Payment nunca é criado manualmente pelo usuário. Rota `POST /payments` e todo o fluxo de criação manual eliminados (issues \#14, \#15, \#16)
- **`UpdatePaymentDto` enxugado** — removidos `status`, `total`, `paidAmount`, `installmentsPaid`, `lastPaymentAt`, `isActive`. O cliente só pode enviar `discount` e `methods[]`
- **`PaymentMethodItemDto.installments`** — mínimo alterado de `1` para `2`, conforme regra (INSTALLMENT exige >= 2 parcelas)
- **`PaymentMethodItemDto.amount`** — mínimo alterado de `0` para `0.01`

### `payment-installment.dto.ts`

- **`CreatePaymentInstallmentDto` removido** — parcelas são geradas internamente pelo service, nunca pelo cliente
- **`UpdatePaymentInstallmentDto` enxugado** — removidos `paidAmount`, `paidAt`, `isActive`, `tenantId`, `branchId`. Apenas `sequence`, `amount` e `dueDate` são editáveis
- **`UpdatePaymentInstallmentDto.amount`** — mínimo alterado para `0.01`

---

## Repository

### `payment.repository.ts`

- **`paymentInclude` extraído como constante** — eliminava repetição idêntica em `create`, `update`, `findById`, `findBySaleId` e `findAllByTenant`
- **`findById` corrigido** — alterado de `findUnique` para `findFirst` com filtro opcional de `tenantId`. Qualquer busca por ID agora pode exigir que o registro pertença ao tenant do usuário (issue \#19)
- **`findBySaleId`** — passou a usar o `paymentInclude` completo, incluindo `saleDate`
- **`softDelete` removido** — Payment não tem operação de soft delete exposta. O ciclo de vida é gerenciado via `status`

### `payment-method-item.repository.ts`

- **`methodItemInclude` extraído como constante** — eliminava repetição em `create`, `update`, `findById`, `findByPaymentId`

### `payment-installment.repository.ts`

- **`installmentInclude` extraído como constante** — eliminava repetição em `create`, `update`, `findById`
- **`tenantId` adicionado ao select de `payment`** dentro do include — necessário para validação de tenant no service sem query adicional
- **`softDelete` removido** — não usado no fluxo atual; deleção é sempre via `deleteByMethodItemId`

---

## Services

### `payment-integrity.service.ts`

- **`generateInstallments`: algoritmo de datas corrigido** — substituído `dueDate.setDate(getDate() + (i-1) * 30)` (30 dias fixos) por `new Date(year, month + (i-1), day)` com incremento real de mês. Adicionado fallback para último dia do mês quando o dia não existe no mês destino (ex: dia 31 em fevereiro) (issue \#20)
- **`generateInstallments`: truncamento e remainder corrigidos** — valor de cada parcela calculado com `Math.floor((amount / installments) * 100) / 100`. O `remainder` (centavos restantes) é somado à **última parcela** para fechar o valor exato, sem arredondamentos que gerariam diferença
- **`recalculatePaymentStatus` consolidado aqui** como método canônico — calcula `paidAmount` somando métodos à vista `isPaid: true` + `paidAmount` de todas as parcelas, atualiza `installmentsPaid` e deriva `status` (`CONFIRMED` se `paidAmount >= total`)
- **Constante `INSTANT_METHODS` centralizada** aqui — removida a duplicação que existia no `payment-update.service`

### `payment-installment-pay.service.ts`

- **`paidAt` corrigido** — gravado **somente** quando `newPaidAmount >= installment.amount` (quitação integral). Pagamentos parciais acumulam `paidAmount` sem tocar em `paidAt`. Uso de spread condicional `...(effectivePaidAt ? { paidAt } : {})` — nunca passa `null` explicitamente, evitando sobrescrever valor existente (issue \#25)
- **Recálculo dentro de `$transaction`** — toda a atualização da parcela + recálculo de `paidAmount`, `installmentsPaid`, `status` e `lastPaymentAt` do Payment ocorrem dentro da mesma `prisma.$transaction`. Se o recálculo falhar, a atualização da parcela é revertida (issue \#26)
- **`lastPaymentAt`** atualizado apenas na quitação integral da parcela, dentro da transaction
- **Validação de `payment.status === CANCELED`** adicionada — bloqueia pagamento em Payment cancelado
- **Validação de `amountToPay > remaining`** com tolerância de `0.001` para evitar falsos positivos de floating point

### `payment.service.ts`

- **`create` removido** — Payment não é criado manualmente (issues \#14, \#17, \#18)
- **`delete` removido** — Payment não é deletado diretamente
- **`findById` e `findStatusBySaleId`** agora passam `tenantId` para o repo — isolamento multi-tenant garantido (issue \#19)
- **`validate` movido para cá** — estava em `PaymentUpdateService`, responsabilidade mais coesa no service de leitura
- **`validate`** agora passa `tenantId` no `findById` — sem necessidade de comparar `payment.tenantId` manualmente depois
- **`subtotal` adicionado ao `stats`** do validate

### `payment-update.service.ts`

- **`update` reescrito** — aceita apenas `discount` e `methods[]`. Campos como `status`, `total`, `paidAmount` não são mais aceitos do cliente
- **Validação de `discount`**: bloqueia se `paidAmount > 0`, se qualquer método está `isPaid: true` ou qualquer parcela tem `paidAt !== null`; bloqueia se já existem métodos e o novo total não bate com a soma deles (usuário deve remover métodos antes)
- **Validações de `methods[]`**: máximo 2 métodos; no máximo 1 `INSTALLMENT`; `paidAt` obrigatório para métodos à vista; `installments >= 2` e `firstDueDate` obrigatórios para `INSTALLMENT` (issues \#21, \#22)
- **`updateStatus` com cancelamento** agora restaura estoque de todos os `ItemProduct` da Sale vinculada dentro de `prisma.$transaction`
- **`validate` removido daqui** — movido para `PaymentService`
- **`tenantId` passado para `findById`** em todas as buscas
- **Constante `INSTANT_METHODS`** importada localmente (não duplicada do integrity service)

### `payment-method-item.service.ts`

- **`create` e `update` removidos** — métodos são gerenciados exclusivamente via `PUT /payments/:id` (replace strategy)
- **Apenas `delete` mantido** com validações completas: `payment.status !== PENDING` bloqueia; `isPaid: true` em método à vista bloqueia; parcela com `paidAt !== null` bloqueia
- **`recalculatePaymentStatus` chamado após remoção** — se o Payment estava `CONFIRMED` e o método à vista for removido, volta para `PENDING`

### `payment-installment.service.ts`

- **Validação de tenant em `findByPaymentId`** — usa `findById(id, tenantId)` do repo em vez de comparar `payment.tenantId` manualmente
- **Validação de tenant em `findById` e `update`** — lê `installment.paymentMethodItem.payment.tenantId` (campo disponível após ajuste no repository)
- **Bloqueio de edição em `update`** — alterado de `paidAmount > 0` para `paidAt !== null`. Alinhado com a regra: bloqueia apenas na quitação integral, não em pagamentos parciais
- **Validação de `dueDate` via `isNaN` removida** — redundante, o DTO já garante `@IsDate()`
- **Desestruturação explícita** de `{ amount, dueDate, sequence }` no update — evita passar campos não permitidos para o repo

---

## Controller

### `payment.controller.ts`

- **`createPayment` e `deletePayment` removidos**
- **`handleError` local substituído por `next(err)`** em todos os handlers (issue \#23)
- **`validatePayment`** agora chama `paymentService.validate` (movido do update service)

### `payment-installment.controller.ts`

- **`handleError` local substituído por `next(err)`** em todos os handlers (issue \#24)
- **Import de `PaymentInstallmentUpdateService` removido** — não existe; `updateInstallment` delega para `PaymentInstallmentService.update`
- **Lógica inline removida** — `listInstallmentsByPayment`, `getInstallmentById` e `listOverdueInstallments` delegam integralmente para o service, sem query ou enrich no controller

### `payment-method-item.controller.ts`

- **`createMethodItem` e `updateMethodItem` removidos**
- Arquivo enxuto com apenas `deleteMethodItem`

---

## Routes

### `payment.routes.ts`

- **`POST /`** removido — Payment não é criado manualmente
- **`DELETE /:id`** removido — Payment não é deletado diretamente
- Imports de `CreatePaymentDto`, `createPayment` e `deletePayment` removidos

### `payment-installment.routes.ts`

- Import de `CreatePaymentInstallmentDto` removido
- Ordem das rotas preservada: estáticas (`/overdue`, `/by-payment/:paymentId`) antes das dinâmicas (`/:id`) para evitar conflito de matching

### `payment-method-item.routes.ts`

- **`POST /` e `PUT /:id`** removidos — operações centralizadas no `PUT /payments/:id`
- Apenas `DELETE /:id` exposto

---

## Issues fechadas

| \#   | Problema                                          | Arquivo                          |
| :--- | :------------------------------------------------ | :------------------------------- |
| \#14 | `CreatePaymentDto` + `POST /payments` removidos   | dto, service, controller, routes |
| \#15 | `status` aceito do cliente na criação             | dto                              |
| \#16 | `tenantId`/`branchId` aceitos do cliente          | dto                              |
| \#17 | `saleId` sem validação de tenant no create        | service removido                 |
| \#19 | `findById` sem filtro de `tenantId`               | repository, todos os services    |
| \#20 | Parcelas geradas com `+30 dias fixos`             | integrity service                |
| \#21 | Assimetria `paidAt` à vista no update             | update service                   |
| \#22 | `INSTALLMENT` sem `firstDueDate` não validado     | update service                   |
| \#23 | `handleError` local no payment controller         | controller                       |
| \#24 | `handleError` local no installment controller     | controller                       |
| \#25 | `paidAt: null` sobrescrevendo valor existente     | installment-pay service          |
| \#26 | `recalculatePaymentStatus` fora de `$transaction` | installment-pay service          |
