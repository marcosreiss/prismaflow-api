# Endpoints e Principais Regras de Negócio

## Convenções gerais

- prefixo base: `/api`
- autenticação: `Authorization: Bearer <token>`
- respostas de sucesso usam majoritariamente `ApiResponse` ou `PagedResponse`
- validação estrutural é feita por DTOs
- regras de negócio adicionais são aplicadas nos services

## Auth

### `POST /api/auth/register-admin`

Cria:

- tenant
- primeira filial
- usuário administrador inicial

Body principal:

- `tenantName`
- `branchName`
- `name`
- `email`
- `password`

Regras:

- e-mail não pode estar em uso
- operação é transacional

### `POST /api/auth/login`

Body:

- `email`
- `password`

Regras:

- usuário precisa existir
- senha deve conferir
- se `ADMIN` não tiver `branchId`:
  - com uma filial disponível, login final é emitido diretamente
  - com múltiplas filiais, retorna `tempToken` e lista de filiais

### `POST /api/auth/branch-selection`

Requer token temporário no header `Authorization`.

Body:

- `branchId`

Regras:

- token deve conter `isTemp`
- token temporário deve estar válido
- após seleção, retorna token JWT final com `branchId`

### `PUT /api/auth/change-password`

Autenticado.

Body:

- `currentPassword`
- `newPassword`

### `POST /api/auth/register-user`

Autenticado e restrito a `ADMIN`.

Body:

- `name`
- `email`
- `password`
- `role`
- `tenantId`
- `branchId`

Observação:

- este endpoint convive com o módulo `/api/users`, que também cria usuários por outra trilha

## Branches

### `POST /api/branches`

Autenticado, `ADMIN`.

Body:

- `name`

Regras:

- apenas administradores criam filiais
- nome deve ser único dentro do tenant

### `GET /api/branches/select`

Autenticado, qualquer papel.

Retorna lista simplificada de filiais do tenant.

### `GET /api/branches`

Autenticado, `ADMIN`.

Query:

- `page`
- `limit`

## Users

### `POST /api/users`

Autenticado.

Body:

- `name`
- `email`
- `password`
- `role`
- `branchId` opcional no DTO, mas obrigatório para `MANAGER` e `EMPLOYEE`

Regras centrais:

- `ADMIN` cria `MANAGER` e `EMPLOYEE`
- `MANAGER` cria somente `EMPLOYEE`
- `EMPLOYEE` não cria ninguém
- para `MANAGER` e `EMPLOYEE`, `branchId` é obrigatório
- se o criador é `MANAGER`, o `branchId` deve ser a própria filial do gerente
- e-mail deve ser único

### `GET /api/users`

Regras:

- `ADMIN` vê todos os usuários do tenant
- `MANAGER` vê apenas `EMPLOYEE` da sua filial
- `EMPLOYEE` recebe acesso negado

## Brands

Todos os endpoints exigem autenticação e `ADMIN`.

### `POST /api/brands`

Body:

- `name`
- `isActive` opcional

### `GET /api/brands`

Query:

- `page`
- `limit`
- `search`

### `GET /api/brands/:id`

Busca marca por ID.

### `PUT /api/brands/:id`

Body:

- `name` opcional
- `isActive` opcional

### `DELETE /api/brands/:id`

Observação:

- a exclusão é física no repository, não soft delete

## Products

Todos os endpoints exigem autenticação.

### `POST /api/products`

Body principal:

- `name`
- `description`
- `costPrice`
- `markup`
- `salePrice`
- `stockQuantity`
- `minimumStock`
- `category`
- `brandId`

Regras:

- `brandId` é obrigatório
- `tenantId` e `branchId` são definidos pelo token
- não permite duplicidade de nome + marca no tenant

### `GET /api/products`

Query:

- `page`
- `limit`
- `search`
- `category`
- `brandId`

### `GET /api/products/:id`

Regra:

- produto precisa pertencer ao tenant do usuário

### `PUT /api/products/:id`

Atualiza campos opcionais do produto.

### `DELETE /api/products/:id`

Regra:

- produto precisa pertencer ao tenant do usuário

### `GET /api/products/:id/stock`

Retorna `productId` e `stockQuantity`.

## Optical Services

Todos os endpoints exigem autenticação.

### `POST /api/optical-services`

Body:

- `name`
- `description` opcional
- `price`
- `isActive` opcional

Regras:

- usuário precisa ter `branchId`
- `branchId` enviado pelo cliente é ignorado
- nome não pode duplicar no tenant

### `GET /api/optical-services`

Query:

- `page`
- `limit`
- `search`

### `GET /api/optical-services/:id`

### `PUT /api/optical-services/:id`

### `DELETE /api/optical-services/:id`

Regra geral:

- serviço deve pertencer ao tenant

## Clients

Todos os endpoints exigem autenticação.

### `POST /api/clients`

Papéis:

- `ADMIN`
- `MANAGER`
- `EMPLOYEE`

Body principal:

- `name`
- `cpf` opcional
- `bornDate` opcional
- dados de contato, endereço e observações

Regras:

- `tenantId` e `branchId` vêm do token
- `bornDate` é convertida para `Date`
- CPF deve ser único no tenant
- trata colisão `P2002` para cenários concorrentes

### `PUT /api/clients/:id`

Regras:

- cliente precisa existir no tenant
- se CPF mudar, o novo CPF não pode pertencer a outro cliente do mesmo tenant

### `GET /api/clients/select`

Query:

- `name` obrigatório

### `GET /api/clients/:clientId/prescriptions`

Retorna prescrições do cliente.

### `GET /api/clients/birthdays`

Query:

- `page`
- `limit`
- `date` opcional no formato `YYYY-MM-DD`

### `GET /api/clients`

Query:

- `page`
- `limit`
- `search`
- `branchId` opcional

### `GET /api/clients/:id`

Busca detalhada do cliente.

## Prescriptions

Todos os endpoints exigem autenticação.

### `POST /api/prescriptions`

Body principal:

- `clientId`
- `prescriptionDate`
- campos ópticos e observações

Regras:

- `tenantId` e `branchId` são injetados pelo service

### `PUT /api/prescriptions/:id`

### `GET /api/prescriptions/expired`

Query:

- `page`
- `limit`
- `date` opcional

### `GET /api/prescriptions/:id`

### `DELETE /api/prescriptions/:id`

Papéis:

- `ADMIN`
- `MANAGER`

### `GET /api/prescriptions`

Query:

- `page`
- `limit`
- `clientId` opcional

## Sales

Todos os endpoints exigem autenticação.

### `POST /api/sales`

Body principal:

- `clientId`
- `saleDate`
- `prescriptionId` opcional
- `notes`
- `subtotal`
- `discount`
- `total`
- `productItems[]`
- `serviceItems[]`
- `protocol` opcional

Regras centrais:

- cliente deve existir
- deve haver ao menos um produto ou serviço
- data da venda não pode ser futura
- produto precisa existir
- serviço precisa existir
- estoque do produto deve ser suficiente
- venda cria automaticamente um `Payment` inicial `PENDING`
- se produto for `FRAME` e houver `frameDetails`, cria detalhes da armação

### `GET /api/sales`

Query:

- `page`
- `limit`
- `clientId` opcional
- `clientName` opcional

### `GET /api/sales/:id`

Retorna venda detalhada com cliente, protocolo, prescrição e itens.

### `PUT /api/sales/:id`

Regras centrais:

- venda deve existir
- payment relacionado deve existir
- venda só pode ser editada se o payment estiver `PENDING` e sem pagamento iniciado
- ao alterar itens de produto, o estoque é recalculado
- itens removidos restauram estoque
- atualiza ou cria protocolo
- sincroniza `total` e `discount` do payment
- usa transação Prisma

### `DELETE /api/sales/:id`

Regras centrais:

- venda deve existir
- payment da venda deve existir
- não pode excluir venda já paga ou parcialmente paga
- restaura estoque dos itens
- remove frame details, itens de serviço, protocolo e payment
- faz soft delete da venda (`isActive = false`)

## Payments

Todos os endpoints exigem autenticação.

### `POST /api/payments`

Body principal:

- `saleId`
- `total`
- `discount` opcional
- `methods[]`

Cada item de `methods[]`:

- `method`
- `amount`
- `installments` opcional
- `firstDueDate` opcional
- `paidAt` opcional

Regras:

- soma dos métodos deve ser igual ao total
- métodos parcelados geram parcelas automaticamente

### `GET /api/payments`

Query suportada:

- `page`
- `limit`
- `status`
- `method`
- `startDate`
- `endDate`
- `clientId`
- `clientName`
- `hasOverdueInstallments`
- `isPartiallyPaid`
- `dueDaysAhead`

### `GET /api/payments/by-sale/:saleId`

Retorna `saleId`, `paymentId` e `status`.

### `GET /api/payments/:id/validate`

Executa validação de integridade do payment.

### `PATCH /api/payments/:id/status`

Body:

- `status`
- `reason` opcional

Regras:

- `CONFIRMED -> PENDING` não é permitido
- payment `CANCELED` não pode voltar a outro estado

### `GET /api/payments/:id`

### `PUT /api/payments/:id`

Regras centrais:

- payment deve existir
- tenant deve coincidir
- payment cancelado não pode ser atualizado
- payment confirmado só permite alteração de `status` para cancelamento
- se `methods[]` for enviado, ele substitui completamente os métodos existentes
- não é permitido trocar métodos se já houver parcelas pagas ou métodos pagos
- soma dos novos métodos deve bater com o total
- métodos parcelados exigem `firstDueDate`
- métodos instantâneos exigem `paidAt`

### `DELETE /api/payments/:id`

Regra:

- somente `PENDING` pode ser removido
- remoção é lógica (`isActive = false`)

## Payment Installments

Todos os endpoints exigem autenticação.

### `GET /api/payment-installments/overdue`

Retorna parcelas vencidas e estatísticas.

### `GET /api/payment-installments/by-payment/:paymentId`

Retorna resumo e lista enriquecida de parcelas.

### `GET /api/payment-installments/:id`

Busca parcela detalhada.

### `PUT /api/payment-installments/:id`

Body:

- `sequence` opcional
- `amount` opcional
- `dueDate` opcional

Regras:

- não permite editar parcela que já recebeu pagamento
- se `amount` mudar, a soma de parcelas do método precisa continuar igual ao valor do método
- `dueDate` deve ser válida

### `PATCH /api/payment-installments/:id/pay`

Body:

- `paidAmount`
- `paidAt` opcional

Regras:

- parcela deve existir
- tenant deve coincidir
- parcela totalmente quitada não pode receber novo pagamento
- valor pago não pode exceder o saldo restante
- `paidAt` é gravado somente quando a parcela for quitada integralmente
- o payment agregado é recalculado após o registro

## Expenses

Todos os endpoints exigem autenticação e papel `ADMIN` ou `MANAGER`.

### `POST /api/expenses`

Body:

- `description`
- `amount`
- `dueDate`
- `status` opcional
- `paymentDate` opcional
- `paymentMethod` opcional

### `PUT /api/expenses/:id`

### `GET /api/expenses`

Query:

- `page`
- `limit`
- `branchId`
- `status`
- `search`

### `GET /api/expenses/:id`

### `DELETE /api/expenses/:id`

## Dashboard

Todos os endpoints exigem autenticação e papel `ADMIN` ou `MANAGER`.

### `GET /api/dashboard/balance`

Retorna:

- `revenue`
- `expenses`
- `netProfit`

### `GET /api/dashboard/sales-summary`

Retorna:

- `count`
- `totalRevenue`
- `averageTicket`

### `GET /api/dashboard/payments-status`

### `GET /api/dashboard/top-products`

### `GET /api/dashboard/top-clients`

### `GET /api/dashboard/overdue-installments`

## Regras transversais mais importantes

- isolamento por `tenantId`
- uso recorrente de `branchId` como contexto operacional
- payload estrito com `forbidNonWhitelisted`
- estoque afetado por criação, atualização e exclusão de venda
- integridade financeira controlada por services
- formato de erro majoritariamente padronizado, mas não 100% uniforme
