# Implementação em Sales

Implementamos o módulo de **Sales** com a estrutura completa de DTOs, repository, service, controller e routes, alinhado às regras de negócio e ao padrão arquitetural que vocês já vinham usando.

## O que entrou

- **DTOs de entrada** para criação e atualização de venda, itens de produto, itens de serviço, protocolo e frame details, com validações de tipo e obrigatoriedade.
- **Repository de Sale** com consultas e operações de persistência para:
  - criar e atualizar sale;
  - criar e atualizar protocolo;
  - buscar sale por ID;
  - listar por tenant com paginação e filtro por cliente;
  - listar por cliente;
  - buscar itens de produto, frame details e itens de serviço;
  - soft delete no comportamento anterior do repositório, embora a regra final tenha mudado para hard delete na venda.
- **Service de Sale** com a regra principal do módulo:
  - valida cliente do tenant;
  - valida data da venda;
  - exige ao menos um item de produto ou serviço;
  - recalcula subtotal e total no backend;
  - cria a sale dentro de transaction;
  - cria payment automaticamente com status `PENDING`;
  - cria itens de produto, itens de serviço e protocolo;
  - valida estoque e atualiza quantidades;
  - valida e cria `frameDetails` quando o produto é de armação.
- **Update de sale** com lógica de substituição dos itens, recalculo de valores e atualização de payment, com proteção contra edição quando o pagamento já foi iniciado ou pago.
- **Delete de sale** convertido para **hard delete em cascata**, restaurando estoque antes de remover os registros dependentes.
- **Controller e routes** seguindo o padrão do projeto:
  - controller só orquestra e chama `next(err)`;
  - routes com `authGuard`;
  - validação de DTO no `POST` e `PUT`;
  - endpoint para listar vendas por cliente.

## Regras atendidas

- A venda é tratada como entidade central, com `Payment` vinculado automaticamente na criação.
- `clientId`, `saleDate` e vínculo com tenant são validados no service, não confiados ao frontend.
- `sale.subtotal` e `sale.total` passam a ser calculados pela API, não aceitos do cliente como fonte de verdade.
- O fluxo de criação ocorre dentro de uma única transaction.
- A edição respeita a estratégia de replace dos itens com ajuste de estoque.
- O delete segue a ordem correta de cascata para evitar erro de FK e restaurar estoque corretamente.

## Correções técnicas importantes

- Corrigimos o problema de `FrameMaterialType | undefined` garantindo `material` antes de criar `frameDetails`.
- Corrigimos o problema de tipagem do `tx` usando um tipo inferido da própria transaction do Prisma, evitando conflito com o client estendido.
- Ajustamos imports para o padrão do projeto com `@/` e `logger` default export.
- Padronizamos controller para não responder direto com `res.status(400)` em erro local, seguindo o fluxo global do projeto.

## Ponto que ficou de fora

- O módulo ainda pode precisar de ajuste fino em **nomes exatos de campos do schema** e em alguns tipos do Prisma, principalmente nos trechos de `payment`, `product.category` e `protocol`, caso o seu schema real tenha nomes diferentes dos inferidos pelos arquivos resumidos.

Se quiser, eu posso fazer agora um **resumo ainda mais curto, em formato de changelog**, pronto para você colar no commit ou no PR.
