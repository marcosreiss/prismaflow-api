# Regras de Negócio — Payment

## 1. Visão Geral

Um `Payment` representa o registro financeiro de uma `Sale`. Ele é criado automaticamente
junto com a venda e nunca pode ser criado manualmente pelo usuário. O Payment agrega
`PaymentMethodItem` (formas de pagamento) e `PaymentInstallment` (parcelas de métodos
parcelados). O ciclo de vida do Payment determina o que pode ser feito com a Sale vinculada.

---

## 2. Modelo Financeiro

```
payment.subtotal = sale.total
payment.total    = payment.subtotal - payment.discount
```

- `payment.subtotal` recebe `sale.total` no momento da criação e é recalculado
  automaticamente sempre que `sale.total` mudar (via edição da Sale).
- `payment.discount` é um desconto adicional concedido no momento do pagamento,
  independente do desconto da venda. Opcional, padrão `0`. Qualquer usuário autenticado
  pode aplicá-lo via `PUT /api/payments/:id`.
- `payment.total` é o valor que o cliente efetivamente deve pagar.
- A soma de todos os `PaymentMethodItem.amount` deve ser exatamente igual a `payment.total`.

---

## 3. Criação do Payment

O Payment **nunca é criado pelo usuário**. A rota `POST /api/payments` e o
`PaymentService.create` devem ser removidos.

O Payment é criado automaticamente pelo `SaleService` no momento da criação da Sale,
dentro da mesma `prisma.$transaction`, com os seguintes valores iniciais:

| Campo              | Valor inicial     |
| ------------------ | ----------------- |
| `saleId`           | ID da Sale criada |
| `status`           | `PENDING`         |
| `subtotal`         | `sale.total`      |
| `total`            | `sale.total`      |
| `discount`         | `0`               |
| `paidAmount`       | `0`               |
| `installmentsPaid` | `0`               |
| `lastPaymentAt`    | `null`            |
| `tenantId`         | do token          |
| `branchId`         | do token          |

---

## 4. Atualização do Payment (`PUT /api/payments/:id`)

Este é o endpoint principal pelo qual o usuário registra como a venda será paga.
Ele permite atualizar `discount` e/ou `methods[]`.

### 4.0 Diff de payload antes das regras

O frontend pode reenviar o objeto inteiro do pagamento, mesmo quando nada foi alterado.

Por isso, antes de aplicar validações de negócio, a API:

1. carrega o `Payment` persistido com seus métodos
2. monta uma versão comparável do estado atual
3. compara o payload recebido campo a campo
4. executa o restante do fluxo usando apenas os campos realmente alterados

Hoje esse diff cobre:

- `discount`
- `methods[]`

Na comparação de `methods[]`, a API considera apenas os campos editáveis do método:

- `method`
- `amount`
- `installments`
- `firstDueDate`
- `isPaid`
- `paidAt`

As parcelas geradas automaticamente (`PaymentInstallment`) não entram nesse diff, porque são derivadas da configuração do método e não fazem parte do payload de atualização do Payment.

### 4.1 Pré-condições de bloqueio total

A atualização é **completamente bloqueada** se:

| Condição                       | Motivo                        |
| ------------------------------ | ----------------------------- |
| `payment.status === CANCELED`  | Payment cancelado é imutável  |
| `payment.status === CONFIRMED` | Payment confirmado é imutável |
| `tenantId` não coincide        | Isolamento multi-tenant       |

### 4.2 Atualização de `discount`

- Permitida enquanto `status === PENDING` e sem pagamentos registrados
  (`paidAmount === 0`, nenhum método com `isPaid: true`, nenhuma parcela com `paidAt`)
- Só entra nessa validação se `discount` realmente tiver mudado em relação ao valor persistido
- Após atualizar `discount`, `payment.total` é recalculado:
  ```
  payment.total = payment.subtotal - payment.discount
  ```
- Se já existirem métodos registrados e o novo `total` não bater com a soma dos métodos,
  a operação é bloqueada — o usuário deve remover os métodos antes de alterar o desconto.

### 4.3 Atualização de `methods[]`

Quando `methods[]` é enviado, os métodos existentes são **completamente substituídos**
(replace strategy), desde que nenhum método ou parcela já tenha sido pago.

Se o frontend reenviar `methods[]` sem alterações reais, nenhum replace é executado.

#### Regras de substituição

- Bloqueada se qualquer `PaymentMethodItem.isPaid === true`
- Bloqueada se qualquer `PaymentInstallment.paidAt !== null`
- A soma dos `amount` de todos os métodos enviados deve ser exatamente igual a `payment.total`
- Máximo de **2 métodos** por Payment
- Não é permitido mais de um método do tipo `INSTALLMENT`

#### Regras por tipo de método

**Métodos à vista (`PIX`, `MONEY`, `DEBIT`, `CREDIT`)**

- `paidAt` é **obrigatório** — a data real do recebimento pode diferir da data da request
- São registrados com `isPaid: true` automaticamente
- Não geram parcelas (`PaymentInstallment`)

**Método parcelado (`INSTALLMENT`)**

- `installments` (quantidade de parcelas) é **obrigatório** e deve ser >= 2
- `firstDueDate` é **obrigatório**
- `paidAt` não se aplica neste momento — o pagamento ocorre parcela a parcela
- Parcelas são geradas automaticamente (ver Seção 5)
- Registrado com `isPaid: false` até todas as parcelas serem quitadas

#### Processo de substituição (dentro de `prisma.$transaction`)

1. Deletar todas as `PaymentInstallment` dos métodos existentes
2. Deletar todos os `PaymentMethodItem` existentes
3. Criar os novos `PaymentMethodItem`
4. Para cada método `INSTALLMENT`, gerar as parcelas automaticamente
5. Recalcular `paidAmount` e `status` do Payment

Esse processo só acontece quando o diff detectar mudança real em `methods[]`.

#### Recálculo automático após registro de métodos

Após qualquer alteração nos métodos:

```
payment.paidAmount = soma(amount de métodos isPaid: true)
                   + soma(paidAmount de todas as parcelas)
```

Se `payment.paidAmount >= payment.total` → `status` muda para `CONFIRMED` automaticamente.
Se não → `status` permanece `PENDING`.

---

## 5. Parcelas (`PaymentInstallment`)

### 5.1 Geração automática

As parcelas são geradas automaticamente pelo `PaymentIntegrityService.generateInstallments`
quando um método `INSTALLMENT` é registrado.

**Algoritmo de geração:**

```
installmentValue = floor((amount / installments) * 100) / 100  // trunca em 2 casas
remainder        = amount - (installmentValue * installments)   // centavos restantes

Para cada parcela i de 1 até installments:
  dueDate[i] = firstDueDate com mês incrementado em (i - 1)
  amount[i]  = installmentValue
  // O remainder é adicionado à última parcela para fechar o valor exato
amount[installments] += remainder
```

**Regra de data mensal:**

- A data de vencimento de cada parcela é calculada incrementando o **mês** a partir de
  `firstDueDate`, mantendo o mesmo dia.
- Se o dia não existir no mês destino (ex: dia 31 em fevereiro), usa-se o último dia do mês.
- **Não usar +30 dias fixos** — isso gera datas inconsistentes.

### 5.2 Edição de parcela (`PUT /api/payment-installments/:id`)

Campos editáveis:

| Campo      | Regra                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| `dueDate`  | Deve ser uma data válida                                                                 |
| `amount`   | A soma de todas as parcelas do método deve continuar igual ao `PaymentMethodItem.amount` |
| `sequence` | Apenas para reordenação                                                                  |

- **Bloqueada** se a parcela já tiver `paidAt !== null`
- Após alteração de `amount`, o service valida que a soma das parcelas do método ainda
  bate com `PaymentMethodItem.amount`

### 5.3 Quitação de parcela (`PATCH /api/payment-installments/:id/pay`)

Body:

- `paidAmount` — obrigatório, > 0
- `paidAt` — opcional, padrão `now()`

Regras:

- Parcela já totalmente quitada (`paidAt !== null`) não pode receber novo pagamento
- `paidAmount` não pode exceder o saldo restante da parcela (`amount - paidAmount atual`)
- `paidAt` é gravado **somente** quando `paidAmount acumulado === parcela.amount` (quitação integral)
- Pagamentos parciais acumulam em `paidAmount` mas não gravam `paidAt` até a quitação total

**Recálculo após quitação (dentro de `prisma.$transaction`):**

```
payment.paidAmount = soma(amount de métodos isPaid: true)
                   + soma(paidAmount de todas as parcelas de todos os métodos)

payment.installmentsPaid = count(parcelas com paidAt !== null)

payment.lastPaymentAt = paidAt da parcela recém-quitada

Se payment.paidAmount >= payment.total:
  payment.status = CONFIRMED
```

---

## 6. Máquina de Estados do Payment

```
            ┌─────────────────────────────────┐
            │           PENDING               │
            │  (estado inicial, editável)     │
            └────────────┬────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
   ┌─────────────┐               ┌───────────┐
   │  CONFIRMED  │               │ CANCELED  │
   │ (automático)│               │ (manual)  │
   └─────────────┘               └───────────┘
          │                             │
          ▼                             │
   ┌───────────┐                        │
   │ CANCELED  │◄───────────────────────┘
   │ (manual)  │   (CONFIRMED → CANCELED permitido)
   └───────────┘
```

### Transições permitidas

| De          | Para        | Como                                      |
| ----------- | ----------- | ----------------------------------------- |
| `PENDING`   | `CONFIRMED` | Automático — quando `paidAmount >= total` |
| `PENDING`   | `CANCELED`  | Manual via `PATCH /:id/status`            |
| `CONFIRMED` | `CANCELED`  | Manual via `PATCH /:id/status` (estorno)  |
| `CANCELED`  | qualquer    | **Bloqueado** — estado terminal           |
| `CONFIRMED` | `PENDING`   | **Bloqueado**                             |

### Efeitos do cancelamento (`PENDING` ou `CONFIRMED` → `CANCELED`)

1. `payment.status = CANCELED`
2. Estoque de todos os `ItemProduct` da Sale vinculada é restaurado
   (`product.stockQuantity += itemProduct.quantity` para cada item)
3. A Sale permanece com `isActive: true` para consulta histórica
4. Nenhum campo da Sale ou do Payment pode ser editado após o cancelamento
5. Para refazer a venda, é necessário criar uma nova Sale

---

## 7. Método à vista — regras específicas

- Todo método à vista registrado é **obrigatoriamente** `isPaid: true`
- `paidAt` é obrigatório no registro
- Um método à vista **não pode ter `isPaid` revertido** para `false`
- As únicas operações permitidas em um método à vista após registro:
  - **Atualizar `paidAt`** (corrigir a data do recebimento) — permitido enquanto
    `payment.status === PENDING` e nenhum outro método/parcela bloqueante existir
  - **Remover o método** — permitido enquanto `payment.status === PENDING`
    (ver Seção 8 sobre remoção de método)

---

## 8. Remoção de Método (`DELETE /api/payment-method-items/:id`)

- Permitida apenas enquanto `payment.status === PENDING`
- Para método à vista (`isPaid: true`): sempre removível enquanto PENDING
- Para método `INSTALLMENT`:
  - Permitida apenas se **nenhuma parcela** do método tiver `paidAt !== null`
  - Remove em cascata todas as `PaymentInstallment` do método

**Recálculo após remoção:**

```
payment.paidAmount recalculado
Se payment.paidAmount < payment.total → payment.status = PENDING  (se estava CONFIRMED)
```

---

## 9. Consultas

### `GET /api/payments`

Filtros disponíveis:

- `status`, `method`, `startDate`, `endDate`
- `clientId`, `clientName`
- `hasOverdueInstallments`, `isPartiallyPaid`, `dueDaysAhead`
- `page`, `limit`, `sortOrder`

Retorna enriquecido com:

- `hasOverdueInstallments` — boolean
- `overdueCount` — quantidade de parcelas vencidas
- `nextDueDate` / `nextDueAmount` — próxima parcela a vencer

### `GET /api/payments/by-sale/:saleId`

Retorna `saleId`, `paymentId` e `status`. Útil para o frontend verificar o estado
do pagamento de uma venda sem carregar o objeto completo.

### `GET /api/payments/:id/validate`

Executa validação de integridade completa do Payment:

- Soma dos métodos bate com `payment.total`
- Sequência de parcelas sem lacunas
- Parcelas sem `dueDate`
- `paidAmount` do Payment bate com a soma real

---

## 10. Restrições de Segurança

- Payment nunca é criado manualmente — rota `POST /api/payments` removida
- `tenantId` e `branchId` sempre derivados do token
- `status` nunca é aceito do cliente na criação (sempre inicia como `PENDING`)
- `subtotal` do Payment nunca é aceito do cliente — calculado a partir de `sale.total`
- Validação de `tenantId` em toda operação de leitura e escrita no Payment,
  PaymentMethodItem e PaymentInstallment
- `saleId` do Payment validado como pertencente ao tenant antes de qualquer operação
