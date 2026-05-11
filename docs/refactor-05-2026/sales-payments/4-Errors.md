Com base no diagnóstico inicial + tudo que definimos nas regras de negócio, aqui está a lista consolidada e atualizada:

---

## Módulo `sales` — correções necessárias

| \#  | Arquivo              | Problema                                                                                                      | Prioridade          |
| :-- | :------------------- | :------------------------------------------------------------------------------------------------------------ | :------------------ |
| 1   | `sale.service.ts`    | `create` não usa `$transaction` — Sale, itens, frameDetails, protocolo e Payment são criados em etapas soltas | 🔴 Crítico          |
| 2   | `sale.service.ts`    | `recordNumber` enviado ao `createProtocol` mas não existe no schema                                           | 🔴 Bug              |
| 3   | `sale.service.ts`    | Validação de `saleDate` futura ocorre **após** o `if (errors.length)` — nunca é executada                     | 🔴 Bug              |
| 4   | `sale.service.ts`    | `productRepo.findById` não filtra por `tenantId` — produto de outro tenant pode entrar na venda               | 🔴 Segurança        |
| 5   | `sale.service.ts`    | `delete` não usa `$transaction` — restauração de estoque e deleção em cascata podem falhar no meio            | 🔴 Crítico          |
| 6   | `sale.service.ts`    | `payment.subtotal` nunca é populado na criação — fica `0` no banco                                            | 🔴 Bug financeiro   |
| 7   | `sale.service.ts`    | `sale.subtotal` e `sale.total` aceitos do cliente sem recálculo e validação pela API                          | 🔴 Regra de negócio |
| 8   | `sale.service.ts`    | `updateSale` não bloqueia edição quando `payment.paidAmount > 0` ou métodos/parcelas já pagos                 | 🔴 Regra de negócio |
| 9   | `sale.service.ts`    | `updateSale` atualiza `payment.total` e `payment.discount` mas não atualiza `payment.subtotal`                | 🔴 Bug financeiro   |
| 10  | `sale.service.ts`    | `delete` faz soft delete — deve ser hard delete em cascata total com restauração de estoque                   | 🔴 Regra de negócio |
| 11  | `sale.repository.ts` | `findAllByTenant` não filtra por `isActive: true` — vendas deletadas aparecem na listagem                     | 🟠 Bug              |
| 12  | `sale.controller.ts` | `catch` usa `res.status(500).json(...)` direto em vez de `next(err)` — fora do padrão global                  | 🟠 Qualidade        |
| 13  | `sale.service.ts`    | Uso de `req.user as any` — tipagem insegura, deve usar verificação explícita                                  | 🟡 Qualidade        |

---

## Módulo `payments` — correções necessárias

| \#  | Arquivo                                                                                                                                                                                                                                                    | Problema                                                                                                 | Prioridade          |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :------------------ |
| 14  | `payment.dto.ts`                                                                                                                                                                                                                                           | `CreatePaymentDto` existe — deve ser removido junto com `POST /payments` e `PaymentService.create`       | 🔴 Regra de negócio |
| 15  | `payment.dto.ts`                                                                                                                                                                                                                                           | `CreatePaymentDto` aceita `status` do cliente — cliente pode criar Payment como `CONFIRMED`              | 🔴 Segurança        |
| 16  | `payment.dto.ts`                                                                                                                                                                                                                                           | `CreatePaymentDto` aceita `tenantId` e `branchId` do cliente                                             | 🔴 Segurança        |
| 17  | `payment.service.ts`                                                                                                                                                                                                                                       | `create` não valida se `saleId` pertence ao tenant do usuário                                            | 🔴 Segurança        |
| 18  | `payment.service.ts`                                                                                                                                                                                                                                       | `create` não valida se já existe Payment para o `saleId` — erro P2002 genérico sem mensagem amigável     | 🟠 Robustez         |
| 19  | `payment.repository.ts`                                                                                                                                                                                                                                    | `findById` sem filtro de `tenantId` — qualquer tenant pode acessar qualquer Payment por ID               | 🔴 Segurança        |
| 20  | `payment-integrity.service.ts`                                                                                                                                                                                                                             | Geração de parcelas usa `+30 dias fixos` — deve usar incremento mensal por data real                     | 🔴 Bug de data      |
| 21  | `payment-update.service.ts`                                                                                                                                                                                                                                | Métodos à vista exigem `paidAt` no **update** mas não no **create** — assimetria com as regras definidas | 🟠 Regra de negócio |
| 22  | `payment-update.service.ts`                                                                                                                                                                                                                                | `INSTALLMENT` sem `firstDueDate` não é validado no create                                                | 🟠 Regra de negócio |
| 23  | `payment.controller.ts`                                                                                                                                                                                                                                    | `handleError` local (`res.status(400).json`) em vez de `next(err)` — fora do padrão global               | 🟠 Qualidade        |
| 24  | `payment-installment.controller.ts`                                                                                                                                                                                                                        | Mesmo problema do item 23                                                                                | 🟠 Qualidade        |
| 25  | `payment-installment-pay.service.ts` | `paidAt` é passado como `null` quando o pagamento é parcial, mas o campo `paidAt` no banco deve simplesmente não ser atualizado nesse caso — passar `null` explicitamente sobrescreve um valor que possa já existir | 🔴 Bug                                                                                                   |
| 26  | `payment-installment-pay.service.ts` | `recalculatePaymentStatus` é chamado fora de `$transaction` — se o recálculo falhar após o `update` da parcela, a parcela fica com `paidAmount` atualizado mas o Payment não reflete a mudança                      | 🔴 Crítico                                                                                               |

---

O item **25** ainda está pendente. Manda o `payment-installment-pay.service.ts` para fechar o diagnóstico completo antes de começar a implementação.
