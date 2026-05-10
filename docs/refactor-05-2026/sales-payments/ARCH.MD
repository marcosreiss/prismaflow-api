# Arquitetura dos Módulos Sales e Payments
Com base nas regras definidas e no padrão já estabelecido nos outros módulos, a proposta é:

---

## Módulo `sales`

```
src/modules/sales/
├── dtos/
│   ├── sale.dto.ts                    # CreateSaleDto, UpdateSaleDto
│   ├── item-product.dto.ts            # CreateItemProductDto, UpdateItemProductDto
│   ├── item-optical-service.dto.ts    # CreateItemOpticalServiceDto, UpdateItemOpticalServiceDto
│   ├── frame-details.dto.ts           # CreateFrameDetailsDto, UpdateFrameDetailsDto
│   └── protocol.dto.ts                # CreateProtocolDto, UpdateProtocolDto
│
├── sale.repository.ts                 # Queries Prisma de Sale, Protocol, ItemProduct, ItemOpticalService, FrameDetails
├── sale.service.ts                    # Regras de negócio: create, update, delete, list, findById
├── sale.controller.ts                 # Orquestra req/res, delega via next(err)
└── sale.routes.ts                     # Rotas + authGuard + validateDto
```

**Por que não fragmentar mais o service de Sale?**
Toda a lógica de Sale gira em torno de uma única `$transaction`. Fragmentar em sub-services (ex: `SaleItemService`, `SaleStockService`) quebraria a atomicidade ou exigiria passar o `tx` como parâmetro — o que aumenta acoplamento sem ganho real para o MVP. Um único service bem organizado por seções comentadas é mais fácil de manter aqui.

---

## Módulo `payments`

```
src/modules/payments/
├── dtos/
│   ├── payment.dto.ts                 # UpdatePaymentDto (sem CreatePaymentDto — criação é interna)
│   ├── payment-method-item.dto.ts     # CreatePaymentMethodItemDto, UpdatePaymentMethodItemDto
│   └── payment-installment.dto.ts     # UpdatePaymentInstallmentDto, PayInstallmentDto
│
├── repositories/
│   ├── payment.repository.ts          # CRUD de Payment
│   ├── payment-method-item.repository.ts   # CRUD de PaymentMethodItem
│   └── payment-installment.repository.ts   # CRUD de PaymentInstallment
│
├── services/
│   ├── payment.service.ts             # findAll, findById, findBySaleId, update (discount + methods), delete
│   ├── payment-installment.service.ts # findByPaymentId, findById, findOverdue, update de parcela
│   ├── payment-installment-pay.service.ts  # payInstallment (quitação + recálculo)
│   └── payment-integrity.service.ts   # generateInstallments, recalculateStatus, validateIntegrity
│
├── controllers/
│   ├── payment.controller.ts          # list, getById, getBySale, update, delete, validate
│   └── payment-installment.controller.ts   # listByPayment, getById, overdue, update, pay
│
└── routes/
    ├── payment.routes.ts
    └── payment-installment.routes.ts
```

**Por que o `payment-integrity.service` é separado?**
Ele é invocado por múltiplos serviços (`payment.service`, `payment-installment-pay.service`) e não tem dependência de `Request` — é pura lógica financeira e cálculo. Isolá-lo evita duplicação e facilita testar unitariamente a matemática financeira sem dependência de HTTP.

**Por que não tem `CreatePaymentDto`?**
A criação do Payment é interna ao `SaleService`. O DTO de criação não existe no módulo de payments — o contrato de criação está embutido no `sale.dto.ts` e executado pelo `SaleService` diretamente.

---

## Diferença principal entre os dois módulos

| Aspecto                      | Sales                                   | Payments                                 |
| :--------------------------- | :-------------------------------------- | :--------------------------------------- |
| Services                     | 1 arquivo (tudo em `$transaction`)      | 4 arquivos por responsabilidade distinta |
| Repositories                 | 1 arquivo (Sale + agregados)            | 3 arquivos (cada entidade separada)      |
| Criação via API              | Sim (`POST /sales`)                     | Não (interno ao SaleService)             |
| Complexidade de fragmentação | Baixa — fragmentar quebra a transaction | Alta — cada service tem ciclo próprio    |

Confirma essa arquitetura para começarmos a implementação?
