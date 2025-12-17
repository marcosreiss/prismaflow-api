# Documentação: Sistema de Pagamentos e Parcelamento

## Índice
- [Visão Geral](#visão-geral)
- [Modelos de Dados](#modelos-de-dados)
- [Fluxo de Funcionamento](#fluxo-de-funcionamento)
- [Métodos de Pagamento](#métodos-de-pagamento)
- [Status de Pagamento](#status-de-pagamento)
- [Regras de Negócio](#regras-de-negócio)
- [Endpoints Disponíveis](#endpoints-disponíveis)
- [Casos de Uso](#casos-de-uso)
- [Validações e Restrições](#validações-e-restrições)
- [Observações Finais](#observações-finais)

## Visão Geral
O sistema de pagamentos da PrismaFlow API é responsável por gerenciar todo o ciclo financeiro das vendas, desde a criação automática do pagamento até a quitação total. O sistema suporta múltiplos métodos de pagamento, incluindo parcelamento (carnê) com controle individual de cada parcela.

### Principais Funcionalidades
- Criação automática de pagamento ao criar uma venda
- Parcelamento inteligente com geração automática de parcelas
- Controle granular de pagamento por parcela
- Validação de integridade dos valores e quantidades
- Relatórios avançados de parcelas vencidas e próximas a vencer
- Proteção contra edições que comprometam a consistência dos dados
- Rastreamento completo de histórico de pagamentos

## Modelos de Dados
### Payment (Pagamento)
Representa o registro principal de pagamento vinculado a uma venda.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | Int | Identificador único do pagamento |
| saleId | Int | ID da venda associada (unique) |
| method | Enum | Método de pagamento (PIX, MONEY, DEBIT, CREDIT, INSTALLMENT) |
| status | Enum | Status do pagamento (PENDING, CONFIRMED, CANCELED) |
| total | Float | Valor total do pagamento |
| discount | Float | Desconto aplicado |
| downPayment | Float | Valor de entrada (sinal) |
| installmentsTotal | Int | Quantidade total de parcelas |
| paidAmount | Float | Valor total já pago |
| installmentsPaid | Int | Quantidade de parcelas pagas completamente |
| lastPaymentAt | DateTime | Data do último pagamento recebido |
| firstDueDate | DateTime | Data de vencimento da primeira parcela |
| isActive | Boolean | Indica se o registro está ativo |
| tenantId | String | ID do tenant (multi-tenancy) |
| branchId | String | ID da filial |
| createdAt | DateTime | Data de criação |
| updatedAt | DateTime | Data da última atualização |

### PaymentInstallment (Parcela)
Representa cada parcela individual de um pagamento parcelado.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | Int | Identificador único da parcela |
| paymentId | Int | ID do pagamento associado |
| sequence | Int | Número sequencial da parcela (1, 2, 3...) |
| amount | Float | Valor da parcela |
| paidAmount | Float | Valor já pago da parcela |
| dueDate | DateTime | Data de vencimento |
| paidAt | DateTime | Data em que foi paga |
| isActive | Boolean | Indica se o registro está ativo |
| tenantId | String | ID do tenant |
| branchId | String | ID da filial |
| createdAt | DateTime | Data de criação |
| updatedAt | DateTime | Data da última atualização |

## Fluxo de Funcionamento
1. **Criação de Venda**
   Quando uma venda é criada, automaticamente um registro de Payment é gerado com:
   - status = PENDING
   - method = null (a ser definido posteriormente)
   - total igual ao total da venda
   - Demais campos zerados ou nulos

2. **Definição do Método de Pagamento**
   O usuário edita o pagamento para definir:
   - Método de pagamento (method)
   - Desconto (discount)
   - Entrada (downPayment)
   - Se método = INSTALLMENT: quantidade de parcelas e primeira data de vencimento

3. **Geração Automática de Parcelas**
   Se o método escolhido for INSTALLMENT, o sistema:
   - Calcula o valor a parcelar: total - discount - downPayment
   - Divide igualmente pelo número de parcelas
   - Cria registros em PaymentInstallment com:
     - Sequência numerada (1, 2, 3...)
     - Valor da parcela arredondado para 2 casas decimais
     - Datas de vencimento incrementadas em 30 dias

   **Exemplo:**
   ```
   Total: R$ 1.000,00
   Desconto: R$ 0,00
   Entrada: R$ 200,00
   Parcelas: 4
   Primeira vencimento: 15/12/2025

   Resultado:
   Valor a parcelar = 1000 - 0 - 200 = R$ 800,00
   Cada parcela = 800 / 4 = R$ 200,00

   Parcela 1: R$ 200,00 | Venc: 15/12/2025
   Parcela 2: R$ 200,00 | Venc: 14/01/2026
   Parcela 3: R$ 200,00 | Venc: 13/02/2026
   Parcela 4: R$ 200,00 | Venc: 15/03/2026
   ```

4. **Pagamento de Parcelas**
   Para cada parcela paga, o sistema:
   - Atualiza paidAmount e paidAt da parcela
   - Recalcula installmentsPaid do Payment (conta parcelas 100% pagas)
   - Soma paidAmount de todas parcelas e atualiza no Payment
   - Atualiza lastPaymentAt com a data do último pagamento
   - Se todas parcelas pagas: muda status para CONFIRMED

5. **Validação de Integridade**
   O sistema valida automaticamente:
   - Número de parcelas criadas = installmentsTotal
   - Soma dos valores das parcelas = valor a parcelar
   - Sequência das parcelas sem lacunas ou duplicatas
   - Todas parcelas possuem data de vencimento

## Métodos de Pagamento
| Método | Descrição | Permite Parcelamento |
|--------|-----------|----------------------|
| PIX | Pagamento instantâneo via PIX | Não |
| MONEY | Pagamento em dinheiro/espécie | Não |
| DEBIT | Cartão de débito | Não |
| CREDIT | Cartão de crédito | Não |
| INSTALLMENT | Parcelamento (carnê) | Sim |

## Status de Pagamento
| Status | Descrição | Transições Permitidas |
|--------|-----------|-----------------------|
| PENDING | Aguardando pagamento ou pagamento parcial | → CONFIRMED, CANCELED |
| CONFIRMED | Pagamento totalmente quitado | → CANCELED (apenas) |
| CANCELED | Pagamento cancelado | Nenhuma (estado final) |

## Regras de Negócio
### Criação e Atualização de Pagamentos
1. **Criação Automática**
   - Todo pagamento é criado automaticamente ao criar uma venda
   - Status inicial sempre PENDING
   - Relação 1:1 com venda (um pagamento por venda)

2. **Edição SEM Parcelas Criadas**
   - Campos permitidos: Todos
   - O usuário pode alterar livremente qualquer campo
   - Ao definir method = INSTALLMENT com campos obrigatórios preenchidos, parcelas são geradas

3. **Edição COM Parcelas Criadas (nenhuma paga)**
   - Campos permitidos: method, status, firstDueDate
   - Campos bloqueados: total, installmentsTotal, discount, downPayment
   - **Razão:** Alterar esses valores exigiria recalcular todas as parcelas. O usuário deve editar as parcelas individualmente ou excluí-las antes.

4. **Edição COM Parcelas Pagas**
   - Campos permitidos: status apenas
   - Campos bloqueados: Todos os demais
   - **Razão:** Proteger a integridade financeira. Parcelas pagas não podem ter seus valores retroativamente alterados.

5. **Pagamento Confirmado**
   - Campos permitidos: status (apenas para CANCELED)
   - Campos bloqueados: Todos os demais
   - **Razão:** Pagamentos confirmados só podem ser cancelados, não editados.

6. **Pagamento Cancelado**
   - Nenhuma edição permitida
   - **Razão:** Estado final do pagamento.

### Parcelamento (INSTALLMENT)
#### Campos Obrigatórios
Para criar parcelamento, os seguintes campos são obrigatórios:
- method = INSTALLMENT
- installmentsTotal (mínimo 1)
- firstDueDate
- total > (discount + downPayment)

#### Geração de Parcelas
- **Momento:** Primeira vez que o pagamento é editado com método INSTALLMENT
- **Valor por parcela:** (total - discount - downPayment) / installmentsTotal
- **Arredondamento:** 2 casas decimais
- **Intervalo de vencimento:** 30 dias entre cada parcela
- **Validação pós-geração:** Sistema valida automaticamente a integridade

#### Tolerância de Arredondamento
O sistema aceita diferença de até R$ 0,01 entre:
- Soma das parcelas vs. Valor a parcelar
- **Razão:** Arredondamentos podem gerar diferenças mínimas.

#### Pagamento de Parcelas
**Pagamento Completo**
```json
{
  "paidAmount": 200.00
}
```
- Se paidAmount >= amount: Parcela marcada como paga
- installmentsPaid do Payment é incrementado
- Se todas pagas: status → CONFIRMED

**Pagamento Parcial**
```json
{
  "paidAmount": 100.00
}
```
- Permite múltiplos pagamentos parciais
- Soma acumulativa em paidAmount
- Parcela só conta como paga quando paidAmount >= amount

**Validações**
- ✅ Não pode pagar mais que o valor restante
- ✅ Não pode pagar parcela já quitada
- ✅ Data de pagamento opcional (default: agora)

#### Edição de Parcelas
**Permitido**
- Alterar amount (valor da parcela)
- Alterar dueDate (data de vencimento)
- Alterar sequence (número da parcela)

**Bloqueado**
- ❌ Editar parcelas já pagas (paidAmount > 0)

#### Validação de Soma
Ao alterar amount:
- Sistema valida que soma das parcelas = valor a parcelar
- Se divergir, retorna erro detalhado

**Exemplo de erro:**
```json
{
  "success": false,
  "message": "A soma das parcelas (R$ 850.00) deve ser igual ao valor a parcelar (R$ 800.00).",
  "status": 400
}
```

#### Validação de Integridade
O sistema valida automaticamente:

1. **Quantidade de Parcelas**
   ```
   Parcelas criadas = installmentsTotal
   ```
2. **Soma dos Valores**
   ```
   Σ(parcelas.amount) = total - discount - downPayment
   ```
3. **Sequência Contínua**
   ```
   Sequências = [1, 2, 3, 4...] (sem lacunas)
   ```
4. **Datas de Vencimento**
   ```
   Todas parcelas possuem dueDate
   ```

## Endpoints Disponíveis
### Payments
- **POST /payments**
  - Criar novo pagamento (raramente usado manualmente - venda já cria)

- **GET /payments**
  - Listar pagamentos com filtros avançados
  - **Query Params:**
    - page, limit - Paginação
    - status - Filtrar por status (PENDING, CONFIRMED, CANCELED)
    - method - Filtrar por método (PIX, INSTALLMENT, etc.)
    - startDate, endDate - Filtrar por período
    - clientId, clientName - Filtrar por cliente
    - hasOverdueInstallments=true - Pagamentos com parcelas vencidas
    - isPartiallyPaid=true - Pagamentos parcialmente pagos
    - dueDaysAhead=7 - Pagamentos com parcelas vencendo nos próximos X dias

- **GET /payments/:id**
  - Buscar pagamento por ID com detalhes completos

- **GET /payments/:id/validate**
  - Validar integridade do pagamento
  - **Retorna:**
    - valid: true/false
    - stats - Estatísticas do pagamento
    - issues - Lista de inconsistências (se houver)
    - installments - Lista de parcelas

- **GET /payments/by-sale/:saleId**
  - Buscar status do pagamento por ID da venda

- **PUT /payments/:id**
  - Atualizar pagamento (gera parcelas se INSTALLMENT)
  - Validações aplicadas conforme regras de negócio

- **PATCH /payments/:id/status**
  - Atualizar apenas o status do pagamento
  - **Body:**
    ```json
    {
      "status": "CONFIRMED",
      "reason": "Pagamento confirmado manualmente"
    }
    ```

- **DELETE /payments/:id**
  - Excluir pagamento (soft delete)
  - **Restrição:** Apenas pagamentos PENDING

### Payment Installments
- **GET /payments/:paymentId/installments**
  - Listar parcelas de um pagamento
  - **Retorna:**
    - summary - Resumo (total, pagas, pendentes, vencidas)
    - installments - Lista com campos calculados:
      - isPaid - Parcela paga completamente
      - isPartiallyPaid - Parcela parcialmente paga
      - isOverdue - Parcela vencida
      - daysOverdue - Dias de atraso
      - remainingAmount - Valor restante

- **GET /payments/installments/:id**
  - Buscar parcela específica por ID

- **PATCH /payments/installments/:id/pay**
  - Registrar pagamento de parcela
  - **Body:**
    ```json
    {
      "paidAmount": 200.00,
      "paidAt": "2025-12-16T10:30:00.000Z"
    }
    ```
  - **Efeitos:**
    - Atualiza parcela
    - Recalcula Payment (installmentsPaid, paidAmount, lastPaymentAt, status)

- **PUT /payments/installments/:id**
  - Atualizar parcela (valor ou data)
  - **Body:**
    ```json
    {
      "amount": 250.00,
      "dueDate": "2025-12-20T00:00:00.000Z"
    }
    ```
  - **Validações:**
    - ❌ Não permite editar parcela já paga
    - ✅ Valida soma das parcelas após alteração

- **GET /payments/installments/overdue**
  - Listar parcelas vencidas (relatório)
  - **Query Params:**
    - page, limit - Paginação
  - **Retorna:**
    - Parcelas vencidas não pagas
    - Dados do cliente (nome, telefone)
    - daysOverdue - Dias de atraso
    - stats - Total vencido, valor total, média de dias de atraso

## Casos de Uso
### Caso 1: Venda à Vista com PIX
```json
// 1. Criar venda (Payment PENDING criado automaticamente)
POST /sales
{
  "clientId": 1,
  "total": 500.00,
  "discount": 0,
  ...
}

// 2. Editar pagamento
PUT /payments/1
{
  "method": "PIX",
  "status": "CONFIRMED"
}
```

### Caso 2: Venda Parcelada (Carnê)
```json
// 1. Criar venda (Payment PENDING criado)
POST /sales
{
  "clientId": 1,
  "total": 1000.00,
  "discount": 0,
  ...
}

// 2. Editar pagamento para parcelamento
PUT /payments/1
{
  "method": "INSTALLMENT",
  "total": 1000.00,
  "discount": 0,
  "downPayment": 200.00,
  "installmentsTotal": 4,
  "firstDueDate": "2025-12-15"
}
// Sistema gera 4 parcelas de R$ 200,00 automaticamente

// 3. Cliente paga primeira parcela
PATCH /payments/installments/1/pay
{
  "paidAmount": 200.00
}
// Payment atualizado: installmentsPaid=1, paidAmount=200

// 4. Cliente paga segunda parcela parcialmente
PATCH /payments/installments/2/pay
{
  "paidAmount": 100.00
}
// Parcela 2: paidAmount=100, remainingAmount=100

// 5. Cliente completa segunda parcela
PATCH /payments/installments/2/pay
{
  "paidAmount": 100.00
}
// Parcela 2: paidAmount=200 (PAGA)
// Payment: installmentsPaid=2, paidAmount=400

// 6. Após pagar todas as 4 parcelas
// Payment: status=CONFIRMED automaticamente
```

### Caso 3: Ajustar Valor de Parcela
```json
// Cenário: Precisa alterar parcela 3 de R$ 200 para R$ 250

// 1. Alterar parcela 3
PUT /payments/installments/3
{
  "amount": 250.00
}
// ❌ ERRO: Soma não bate (200+200+250+200 = 850 ≠ 800)

// 2. Ajustar parcela 4 também
PUT /payments/installments/4
{
  "amount": 150.00
}
// ✅ SUCESSO: Soma = 200+200+250+150 = 800
```

### Caso 4: Relatório de Parcelas Vencidas
```json
GET /payments/installments/overdue?page=1&limit=10

// Resposta
{
  "data": {
    "content": [
      {
        "id": 5,
        "sequence": 2,
        "amount": 200.00,
        "paidAmount": 0,
        "dueDate": "2025-11-15",
        "daysOverdue": 32,
        "remainingAmount": 200.00,
        "clientName": "João Silva",
        "clientPhone": "(11) 98765-4321"
      }
    ],
    "stats": {
      "totalOverdue": 12,
      "totalAmount": 2400.00,
      "averageDaysOverdue": 28
    }
  }
}
```

### Caso 5: Filtrar Pagamentos com Parcelas Vencendo
```json
// Listar pagamentos com parcelas vencendo nos próximos 7 dias
GET /payments?dueDaysAhead=7

{
  "data": {
    "content": [
      {
        "id": 3,
        "saleId": 15,
        "status": "PENDING",
        "nextDueDate": "2025-12-20",
        "nextDueAmount": 200.00,
        "client": {
          "name": "Maria Oliveira"
        }
      }
    ]
  }
}
```

## Validações e Restrições
### Validações de Criação
| Validação | Regra | Mensagem de Erro |
|-----------|-------|------------------|
| Sale única | Cada venda pode ter apenas 1 pagamento | "Já existe um pagamento para esta venda." |
| Total positivo | total > 0 | "O valor total deve ser maior que zero." |
| Desconto válido | discount <= total | "O desconto não pode ser maior que o total." |

### Validações de Parcelamento
| Validação | Regra | Mensagem de Erro |
|-----------|-------|------------------|
| Parcelas mínimas | installmentsTotal >= 1 | "Número de parcelas deve ser no mínimo 1." |
| Data obrigatória | firstDueDate required | "Data do primeiro vencimento obrigatória para parcelamento." |
| Valor a parcelar | total - discount - downPayment > 0 | "Valor a parcelar deve ser maior que zero." |
| Método único | Não pode alterar method com parcelas | "Não é possível alterar o método com parcelas criadas." |

### Validações de Pagamento de Parcelas
| Validação | Regra | Mensagem de Erro |
|-----------|-------|------------------|
| Parcela já paga | paidAmount < amount | "Esta parcela já foi paga completamente." |
| Valor máximo | novoPaidAmount <= remainingAmount | "Valor pago não pode ser maior que o restante." |
| Valor mínimo | paidAmount > 0 | "Valor pago deve ser maior que zero." |

### Validações de Edição
| Validação | Regra | Mensagem de Erro |
|-----------|-------|------------------|
| Parcela paga | paidAmount = 0 para editar | "Não é possível editar parcelas que já receberam pagamento." |
| Soma de parcelas | Σ(amount) = valorAParcelar | "A soma das parcelas deve ser igual ao valor a parcelar." |
| Status cancelado | Não pode editar CANCELED | "Não é possível atualizar um pagamento cancelado." |

## Observações Finais
### Boas Práticas
- Sempre validar integridade após operações críticas usando /validate
- Consultar relatórios periodicamente para identificar inadimplência
- Usar filtros avançados para gestão eficiente dos recebíveis
- Documentar motivos ao cancelar pagamentos (campo reason)

### Limitações Conhecidas
- Não suporta renegociação automática de parcelas vencidas
- Não calcula juros ou multas por atraso
- Não permite múltiplos métodos de pagamento na mesma venda
- Não suporta estorno automático de pagamentos confirmados

### Roadmap Futuro
- Cálculo automático de juros e multas
- Geração de boletos bancários
- Integração com gateways de pagamento
- Notificações automáticas de vencimento
- Dashboard financeiro com gráficos
- Exportação de relatórios em PDF/Excel

**Versão da Documentação:** 1.0  
**Última Atualização:** Dezembro/2025  
**Autor:** PrismaFlow Development Team