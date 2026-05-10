# Regras de Negócio — Sale

## 1. Visão Geral

Uma `Sale` representa uma venda completa na ótica. Ela agrega itens de produto, itens de serviço e, opcionalmente, um protocolo de OS. Ao ser criada, um `Payment` é gerado automaticamente e vinculado a ela. Sale e Payment são entidades interdependentes — o ciclo de vida de uma afeta diretamente a outra.

---

## 2. Modelo Financeiro

```
sale.subtotal = soma(itemProduct.unitPrice × quantity) + soma(itemOpticalService.unitPrice)
sale.total    = sale.subtotal - sale.discount
```

- `sale.subtotal` é sempre **recalculado pela API** com base nos itens reais da venda. O valor enviado pelo frontend é validado contra esse cálculo — a fonte de verdade é sempre o service.
- `sale.discount` é o desconto concedido no momento da venda. Opcional, padrão `0`.
- `sale.total` é o valor líquido da venda. Ele alimenta `payment.subtotal` no momento da criação.

---

## 3. Criação de Sale (`POST /api/sales`)

### 3.1 Pré-condições obrigatórias

- `clientId` deve existir e pertencer ao tenant do usuário autenticado
- deve haver ao menos um item em `productItems[]` ou `serviceItems[]`
- `saleDate` não pode ser uma data futura
- cada `productId` deve existir, pertencer ao tenant e estar ativo (`isActive: true`)
- cada `serviceId` deve existir, pertencer ao tenant e estar ativo
- estoque de cada produto deve ser suficiente para a `quantity` solicitada
- `prescriptionId`, se informado, deve pertencer ao mesmo cliente e ao mesmo tenant

### 3.2 Campos de entrada aceitos

| Campo            | Obrigatório | Regra                                              |
|------------------|-------------|----------------------------------------------------|
| `clientId`       | Sim         | Validado no tenant                                 |
| `saleDate`       | Sim         | Não pode ser futura                                |
| `prescriptionId` | Não         | Deve pertencer ao cliente e ao tenant              |
| `notes`          | Não         | Texto livre                                        |
| `discount`       | Não         | >= 0, padrão 0                                     |
| `productItems`   | Condicional | Ao menos um entre productItems ou serviceItems     |
| `serviceItems`   | Condicional | Ao menos um entre productItems ou serviceItems     |
| `protocol`       | Não         | Criado e vinculado automaticamente se informado    |

> `subtotal` e `total` não são aceitos do cliente — calculados pelo service.
> `tenantId`, `branchId`, `createdById` sempre vêm do token.

### 3.3 Efeitos colaterais da criação

1. `sale.subtotal` é calculado pela soma dos itens
2. `sale.total = sale.subtotal - sale.discount`
3. Estoque de cada produto é decrementado por `quantity`
4. `FrameDetails` é criado se `product.category === FRAME` e `frameDetails` for informado no item
5. Um `Payment` é criado automaticamente com:
   - `status: PENDING`
   - `subtotal = sale.total`
   - `total = sale.total`
   - `discount: 0`
   - `paidAmount: 0`
6. Todo o fluxo ocorre dentro de uma única `prisma.$transaction`

### 3.4 Atomicidade

A criação inteira (Sale + itens + frameDetails + protocolo + Payment) ocorre dentro de `prisma.$transaction`. Se qualquer etapa falhar, nenhuma alteração é persistida e o estoque não é afetado.

---

## 4. Edição de Sale (`PUT /api/sales/:id`)

### 4.1 Pré-condições de bloqueio

A edição é **bloqueada** se qualquer uma das condições abaixo for verdadeira:

| Condição                                     | Motivo                                          |
|----------------------------------------------|-------------------------------------------------|
| Payment não existe                           | Inconsistência — venda sem pagamento vinculado  |
| `payment.status !== PENDING`                 | Venda confirmada ou cancelada é imutável        |
| `payment.paidAmount > 0`                     | Já houve recebimento registrado                 |
| Algum `PaymentMethodItem.isPaid === true`    | Método à vista já foi quitado                   |
| Alguma `PaymentInstallment.paidAt !== null`  | Parcela já foi quitada                          |

Se a edição for bloqueada e o usuário precisar corrigir a venda, o caminho é **hard delete da Sale** (ver Seção 6) e criação de uma nova venda.

### 4.2 Campos editáveis

#### Sempre editáveis (sem restrição de estado do Payment)

| Campo            | Observação                         |
|------------------|------------------------------------|
| `saleDate`       | Não pode ser futura                |
| `notes`          | Texto livre                        |
| `prescriptionId` | Deve pertencer ao cliente e tenant |
| `protocol`       | Criado se não existir, atualizado se já existir |

#### Editáveis apenas se Payment estiver PENDING e sem pagamento registrado

| Campo          | Observação                                         |
|----------------|----------------------------------------------------|
| `clientId`     | Novo cliente deve pertencer ao tenant              |
| `discount`     | >= 0                                               |
| `productItems` | Substituição completa da lista (replace strategy)  |
| `serviceItems` | Substituição completa da lista (replace strategy)  |

### 4.3 Recálculo automático após edição

Sempre que `productItems`, `serviceItems` ou `discount` forem alterados:

```
sale.subtotal = soma(itemProduct.unitPrice × quantity) + soma(itemOpticalService.unitPrice)
sale.total    = sale.subtotal - sale.discount
payment.subtotal = sale.total
payment.total    = payment.subtotal - payment.discount
```

O `payment.discount` não é alterado pela edição da Sale — ele é exclusivo do fluxo de pagamento.

### 4.4 Gestão de estoque na edição

A estratégia é **replace completo** com diff de estoque:

1. Para cada item removido (existia antes, não existe mais): estoque é **restaurado**
2. Para cada item novo (não existia antes): estoque é **decrementado**
3. Para cada item com `quantity` alterada:
   - Quantidade aumentou → decrementa a diferença
   - Quantidade diminuiu → restaura a diferença
4. Para itens sem mudança de produto e sem mudança de quantity: estoque não é tocado

### 4.5 Atomicidade

Toda a edição (Sale + itens + frameDetails + protocolo + ajuste de estoque + atualização do Payment) ocorre dentro de `prisma.$transaction`.

---

## 5. Listagem e Consulta

### `GET /api/sales`

- Retorna apenas Sales do tenant do usuário autenticado
- Filtro por `clientId` e `clientName` opcionais
- Paginação com `page` e `limit`
- Ordenado por `saleDate DESC`
- Apenas Sales com `isActive: true`

### `GET /api/sales/:id`

- Retorna a Sale com todos os agregados: client, protocol, prescription, productItems (com produto e frameDetails), serviceItems (com serviço)
- Apenas se `tenantId` coincidir
- Apenas se `isActive: true`

### `GET /api/sales/by-client/:clientId`

- Retorna todas as Sales ativas de um cliente no tenant

---

## 6. Delete de Sale (`DELETE /api/sales/:id`)

### 6.1 Regra geral

O delete de Sale é sempre um **hard delete com cascata total**. Não existe soft delete de Sale.

Não há restrição de estado — o delete é permitido independentemente do status do Payment ou do valor de `paidAmount`.

### 6.2 Cascata obrigatória (dentro de `prisma.$transaction`)

A seguinte ordem deve ser respeitada para evitar erros de FK:

1. `PaymentInstallment` — deletar todas as parcelas dos métodos do Payment vinculado
2. `PaymentMethodItem` — deletar todos os métodos do Payment vinculado
3. `Payment` — deletar o Payment vinculado
4. `FrameDetails` — deletar todos os frameDetails dos itens de produto
5. `ItemProduct` — deletar todos os itens de produto
6. `ItemOpticalService` — deletar todos os itens de serviço
7. `Protocol` — deletar o protocolo se existir
8. `Sale` — deletar a venda

### 6.3 Restauração de estoque

Antes de deletar os `ItemProduct`, o service deve:
- Para cada item: incrementar `product.stockQuantity` pelo `quantity` do item

### 6.4 Atomicidade

Todo o processo de delete ocorre dentro de `prisma.$transaction`. Se qualquer etapa falhar, nada é deletado e o estoque não é afetado.

---

## 7. Cancelamento de Sale

Não existe cancelamento de Sale como operação isolada.

O cancelamento é feito via `PATCH /api/payments/:id/status` com `status: CANCELED`. Ao cancelar o Payment:
- O Payment fica com `status: CANCELED` e não pode ser alterado
- O estoque dos produtos da Sale é restaurado automaticamente
- A Sale permanece ativa nos registros (`isActive: true`) para fins de consulta histórica
- Nenhum campo da Sale ou do Payment pode ser editado após o cancelamento

Se o usuário quiser refazer a venda após um cancelamento, deve criar uma nova Sale.

---

## 8. Estados e Transições

```
[Sale criada] ──► isActive: true  +  Payment: PENDING
                        │
              ┌─────────┴──────────┐
              │                    │
       [Edição permitida]   [Pagamento registrado]
              │                    │
              │             [Payment: CONFIRMED]
              │                    │
        [Hard Delete]        [Hard Delete]
         (cascata)            (cascata)
              │
        [Payment: CANCELED]
         (sale permanece,
          estoque restaurado)
```

---

## 9. Restrições de Segurança

- `tenantId` e `branchId` sempre derivados do token — nunca aceitos do payload
- `unitPrice` dos itens sempre capturado do produto/serviço no momento da operação — nunca aceito do cliente
- Produto de outro tenant não pode ser adicionado a uma venda
- Serviço de outro tenant não pode ser adicionado a uma venda
- Cliente de outro tenant não pode ser vinculado a uma venda
- Prescrição de outro cliente ou tenant não pode ser vinculada a uma venda

---