# Endpoints e Regras de Negócio

## Convenções gerais

- prefixo base: `/api`
- autenticação: `Authorization: Bearer <token>`
- `tenantId` e `branchId` vêm do token
- validação estrutural via DTOs
- regras adicionais nos services

## Auth

- `POST /api/auth/register-admin`
  Cria tenant, primeira filial e primeiro admin.
- `POST /api/auth/login`
  Pode retornar `tempToken` para `ADMIN` sem filial fixa.
- `POST /api/auth/branch-selection`
  Finaliza a seleção de filial.
- `PUT /api/auth/change-password`
  Troca senha do usuário autenticado.
- `POST /api/auth/register-user`
  Restrito a `ADMIN`.

## Branches

- `POST /api/branches`
- `GET /api/branches/select`
- `GET /api/branches`

## Users

- `POST /api/users`
- `GET /api/users`

Regras:

- `ADMIN` cria `MANAGER` e `EMPLOYEE`
- `MANAGER` cria só `EMPLOYEE` na própria filial

## Brands

- `POST /api/brands`
- `GET /api/brands`
- `GET /api/brands/:id`
- `PUT /api/brands/:id`
- `DELETE /api/brands/:id`

## Products

- `POST /api/products`
- `GET /api/products`
- `GET /api/products/:id`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/products/:id/stock`

Regras:

- `brandId` obrigatório
- marca deve pertencer ao tenant
- exclusão usa `softDelete` com histórico

## Optical Services

- `POST /api/optical-services`
- `GET /api/optical-services`
- `GET /api/optical-services/:id`
- `PUT /api/optical-services/:id`
- `DELETE /api/optical-services/:id`

## Clients

- `POST /api/clients`
- `PUT /api/clients/:id`
- `GET /api/clients/select`
- `GET /api/clients/:clientId/prescriptions`
- `GET /api/clients/birthdays`
- `GET /api/clients`
- `GET /api/clients/:id`
- `DELETE /api/clients/:id`

Regras:

- CPF único por tenant
- `EMPLOYEE` restrito à própria filial

## Prescriptions

- `POST /api/prescriptions`
- `PUT /api/prescriptions/:id`
- `GET /api/prescriptions/expired`
- `GET /api/prescriptions/:id`
- `DELETE /api/prescriptions/:id`
- `GET /api/prescriptions`

## Sales

- `POST /api/sales`
- `GET /api/sales`
- `GET /api/sales/:id`
- `GET /api/sales/by-client/:clientId`
- `PUT /api/sales/:id`
- `DELETE /api/sales/:id`

Regras centrais:

- ao menos um produto ou serviço
- data da venda não pode ser futura
- subtotal e total são calculados pela API
- venda cria `Payment` inicial `PENDING`
- edição de itens depende de não haver atividade financeira

## Payments

- `GET /api/payments`
- `GET /api/payments/by-sale/:saleId`
- `GET /api/payments/:id/validate`
- `GET /api/payments/:id`
- `PUT /api/payments/:id`
- `PATCH /api/payments/:id/status`

Regras centrais:

- `Payment` nasce com a venda
- payment cancelado ou confirmado não pode ser editado
- `methods[]` substitui os métodos atuais
- no máximo 2 métodos
- no máximo 1 `INSTALLMENT`
- métodos instantâneos exigem `paidAt`

## Payment Installments

- `GET /api/payment-installments/overdue`
- `GET /api/payment-installments/by-payment/:paymentId`
- `GET /api/payment-installments/:id`
- `PUT /api/payment-installments/:id`
- `PATCH /api/payment-installments/:id/pay`

Regras:

- valor pago não pode exceder saldo restante
- `paidAt` só é gravado na quitação total
- parcelas avançam por mês-calendário

## Expenses

- `POST /api/expenses`
- `PUT /api/expenses/:id`
- `GET /api/expenses`
- `GET /api/expenses/:id`
- `DELETE /api/expenses/:id`

## Dashboard

- `GET /api/dashboard/balance`
- `GET /api/dashboard/sales-summary`
- `GET /api/dashboard/payments-status`
- `GET /api/dashboard/top-products`
- `GET /api/dashboard/top-clients`
- `GET /api/dashboard/overdue-installments`
