import { Request } from "express";
import { SaleRepository } from "./sale.repository";
import { ProductRepository } from "../products/product.repository";
import { OpticalServiceRepository } from "../optical-services/optical-service.repository";
import { PaymentRepository } from "../payments/payment.repository";
import { ClientRepository } from "../clients/client.repository";
import { prisma, withAuditData } from "../../config/prisma-context";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { UpdateSaleDto } from "./dtos/sale.dto";

export class SaleService {
  private saleRepo = new SaleRepository();
  private productRepo = new ProductRepository();
  private opticalRepo = new OpticalServiceRepository();
  private paymentRepo = new PaymentRepository();
  private clientRepo = new ClientRepository();

  // ======================================================
  // CREATE SALE
  // ======================================================
  async create(req: Request) {
    const user = req.user as any;
    const { sub: userId, tenantId, branchId } = user;
    const body = req.body;

    const errors: string[] = [];

    // 1️⃣ Cliente
    const client = await this.clientRepo.findById(
      body.clientId,
      req.user?.tenantId!
    );
    if (!client) errors.push("Cliente não encontrado.");

    // 2️⃣ Itens obrigatórios
    const hasItems =
      (body.productItems && body.productItems.length > 0) ||
      (body.serviceItems && body.serviceItems.length > 0);
    if (!hasItems)
      errors.push("É necessário pelo menos um produto ou serviço.");

    if (errors.length) {
      return ApiResponse.error(errors.join("; "), 400, req);
    }

    // 3️⃣ Criar venda
    const sale = await this.saleRepo.create(
      {
        clientId: body.clientId,
        tenantId,
        branchId,
        subtotal: body.subtotal,
        discount: body.discount ?? 0,
        total: body.total,
        notes: body.notes,
      },
      userId
    );

    // 4️⃣ Protocolo (opcional)
    if (body.protocol) {
      await this.saleRepo.create(
        {
          saleId: sale.id,
          tenantId,
          branchId,
          recordNumber: body.protocol.recordNumber,
          book: body.protocol.book,
          page: body.protocol.page,
          os: body.protocol.os,
        },
        userId
      );
    }

    // 5️⃣ Itens de produto
    if (body.productItems?.length) {
      for (const item of body.productItems) {
        const product = await this.productRepo.findById(item.productId);
        if (!product)
          return ApiResponse.error(
            `Produto não encontrado: ${item.productId}`,
            404,
            req
          );

        if ((product.stockQuantity ?? 0) < item.quantity)
          return ApiResponse.error(
            `Estoque insuficiente para ${product.name}`,
            409,
            req
          );

        // Baixa de estoque
        await this.productRepo.update(
          product.id,
          {
            stockQuantity: (product.stockQuantity ?? 0) - item.quantity,
          },
          userId
        );

        // Criação do item
        const itemProduct = await prisma.itemProduct.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            tenantId,
            branchId,
            createdById: userId,
            updatedById: userId,
          },
        });

        // Frame details se necessário
        if (product.category === "FRAME" && item.frameDetails) {
          await prisma.frameDetails.create({
            data: {
              itemProductId: itemProduct.id,
              material: item.frameDetails.frameMaterialType,
              reference: item.frameDetails.reference,
              color: item.frameDetails.color,
              tenantId,
              branchId,
              createdById: userId,
              updatedById: userId,
            },
          });
        }
      }
    }

    // 6️⃣ Itens de serviço
    if (body.serviceItems?.length) {
      for (const item of body.serviceItems) {
        const service = await this.opticalRepo.findById(item.serviceId);
        if (!service)
          return ApiResponse.error(
            `Serviço não encontrado: ${item.serviceId}`,
            404,
            req
          );

        await prisma.itemOpticalService.create({
          data: {
            saleId: sale.id,
            serviceId: item.serviceId,
            tenantId,
            branchId,
            createdById: userId,
            updatedById: userId,
          },
        });
      }
    }

    // 7️⃣ Pagamento inicial
    const payment = await this.paymentRepo.create(
      {
        saleId: sale.id,
        tenantId,
        branchId,
        total: sale.total,
        discount: sale.discount ?? 0,
        paidAmount: 0,
        status: "PENDING",
      },
      userId
    );

    // 8️⃣ Retorno
    return ApiResponse.success("Venda criada com sucesso.", req, {
      saleId: sale.id,
      clientId: sale.clientId,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      payment,
    });
  }

  // ======================================================
  // UPDATE SALE
  // ======================================================
  async updateSale(req: Request) {
    // Extrai informações básicas da requisição:
    // - id da venda (URL)
    // - corpo da requisição (dados para atualizar)
    // - dados do usuário autenticado (para auditoria e escopo multi-tenant)
    const { id } = req.params;
    const body = req.body as UpdateSaleDto;
    const userId = req.user?.sub;
    const tenantId = req.user?.tenantId!;
    const branchId = req.user?.branchId!;

    // 🔹 1. Buscar a venda existente no banco
    // Verifica se a venda realmente existe antes de tentar atualizar.
    const sale = await this.saleRepo.findById(Number(id), tenantId);
    if (!sale) {
      throw new Error(`Venda ${id} não encontrada`);
    }

    // 🔹 2. Buscar o pagamento vinculado à venda
    // Cada venda tem (ou deve ter) um registro de pagamento relacionado.
    const payment = await prisma.payment.findFirst({
      where: { saleId: Number(id) },
    });
    if (!payment) {
      throw new Error("Pagamento não encontrado para esta venda.");
    }

    // 🔹 3. Validações de status de pagamento
    // Apenas vendas com pagamento "PENDING" podem ser editadas.
    // Se o pagamento já tiver sido parcial ou totalmente feito, bloqueia a edição.
    if (payment.status !== "PENDING") {
      throw new Error(
        "Somente vendas com pagamento PENDING podem ser editadas."
      );
    }
    if ((payment.paidAmount ?? 0) > 0) {
      throw new Error(
        "Não é possível editar uma venda com pagamento parcial ou total."
      );
    }

    // 🔹 4. Atualizar dados principais da venda (cliente, valores, observações, etc.)
    // Se o corpo da requisição tiver um novo cliente, verifica se ele existe.
    if (body.clientId) {
      const client = await this.clientRepo.findById(body.clientId, tenantId);
      if (!client) throw new Error("Cliente não encontrado.");
    }

    // Atualiza os campos básicos da venda, mantendo valores antigos caso algum não tenha sido informado.
    const updatedSale = await this.saleRepo.update(
      Number(id),
      {
        clientId: body.clientId ?? sale.clientId,
        subtotal: body.subtotal ?? sale.subtotal,
        discount: body.discount ?? sale.discount,
        total: body.total ?? sale.total,
        notes: body.notes ?? sale.notes,
        isActive: body.isActive ?? sale.isActive,
      },
      userId
    );

    // 🔹 5. Atualizar itens de produto vinculados à venda
    if (body.productItems) {
      // Busca todos os itens de produto já existentes nessa venda.
      const existingItems = await this.saleRepo.findProductItemsBySale(
        Number(id)
      );

      // Cria um mapa (productId -> DTO) dos novos itens enviados.
      const newItemsMap = new Map(
        body.productItems.map((i) => [i.productId, i])
      );

      // ➕ Percorre cada item existente para ver se será atualizado ou removido.
      for (const existing of existingItems) {
        const dto = newItemsMap.get(existing.product.id);

        // 🧹 Caso o item não esteja mais presente → remover item e devolver estoque
        if (!dto) {
          const product = await this.productRepo.findById(existing.productId);
          if (!product) {
            return ApiResponse.error(
              `Produto não encontrado: ${existing.productId}`,
              404,
              req
            );
          }

          // Devolve a quantidade ao estoque
          await this.productRepo.update(
            product.id,
            { stockQuantity: (product.stockQuantity ?? 0) + existing.quantity },
            userId
          );

          // Remove detalhes de armação (frameDetails) e o item do produto
          await prisma.frameDetails.deleteMany({
            where: { itemProductId: existing.id },
          });
          await prisma.itemProduct.delete({ where: { id: existing.id } });
        } else {
          // 🛠 Caso o item ainda exista, pode ter mudado a quantidade
          const product = await this.productRepo.findById(existing.product.id);
          if (!product) {
            return ApiResponse.error(
              `Produto não encontrado: ${existing.productId}`,
              404,
              req
            );
          }

          const oldQty = existing.quantity;
          const newQty = dto.quantity ?? 0;

          // Se a nova quantidade for maior → precisa verificar se há estoque suficiente
          if (newQty > oldQty) {
            const diff = newQty - oldQty;
            if ((product.stockQuantity ?? 0) < diff) {
              return ApiResponse.error(
                `Estoque insuficiente para o produto ${product.name}`,
                400,
                req
              );
            }
            // Diminui o estoque pela diferença
            await this.productRepo.update(
              product.id,
              { stockQuantity: (product.stockQuantity ?? 0) - diff },
              userId
            );
          }
          // Se for menor → devolve a diferença ao estoque
          else if (newQty < oldQty) {
            const diff = oldQty - newQty;
            await this.productRepo.update(
              product.id,
              { stockQuantity: (product.stockQuantity ?? 0) + diff },
              userId
            );
          }

          // Atualiza a quantidade do item no banco
          await prisma.itemProduct.update({
            where: { id: existing.id },
            data: withAuditData(userId, { quantity: newQty }, true),
          });

          // Atualiza ou cria os detalhes da armação (frameDetails)
          if (dto.frameDetails) {
            const fd = await prisma.frameDetails.findFirst({
              where: { itemProductId: existing.id },
            });

            if (fd) {
              // Atualiza detalhes existentes
              await prisma.frameDetails.update({
                where: { id: fd.id },
                data: withAuditData(
                  userId,
                  {
                    reference: dto.frameDetails.reference,
                    color: dto.frameDetails.color,
                    material: dto.frameDetails.material,
                  },
                  true
                ),
              });
            } else {
              // Cria novos detalhes, se ainda não existirem
              await prisma.frameDetails.create({
                data: withAuditData(userId, {
                  itemProductId: existing.id,
                  tenantId,
                  branchId,
                  reference: dto.frameDetails.reference,
                  color: dto.frameDetails.color,
                  material: dto.frameDetails.material,
                }),
              });
            }
          }
        }
      }

      // ➕ Agora, adiciona novos produtos que não existiam antes na venda.
      for (const dto of body.productItems) {
        const alreadyExists = existingItems.some(
          (i) => i.product.id === dto.productId
        );

        // Se for um item totalmente novo:
        if (!alreadyExists) {
          const product = await this.productRepo.findById(dto.productId);
          if (!product) {
            return ApiResponse.error(
              `Produto não encontrado: ${dto.productId}`,
              404,
              req
            );
          }

          // Verifica estoque antes de inserir
          if ((product.stockQuantity ?? 0) < (dto.quantity ?? 0)) {
            return ApiResponse.error(
              `Estoque insuficiente para o produto ${product.name}`,
              400,
              req
            );
          }

          // Atualiza estoque (remove quantidade vendida)
          await this.productRepo.update(
            product.id,
            {
              stockQuantity: (product.stockQuantity ?? 0) - (dto.quantity ?? 0),
            },
            userId
          );

          // Cria o novo item do produto vinculado à venda
          const itemProduct = await prisma.itemProduct.create({
            data: withAuditData(userId, {
              saleId: Number(id),
              productId: dto.productId,
              quantity: dto.quantity,
              tenantId,
              branchId,
            }),
          });

          // Se houver detalhes de armação, cria também
          if (dto.frameDetails) {
            await prisma.frameDetails.create({
              data: withAuditData(userId, {
                itemProductId: itemProduct.id,
                tenantId,
                branchId,
                reference: dto.frameDetails.reference,
                color: dto.frameDetails.color,
                material: dto.frameDetails.material,
              }),
            });
          }
        }
      }
    }

    // 🔹 6. Atualizar itens de serviço vinculados à venda (ex: ajustes, manutenção, etc.)
    if (body.serviceItems) {
      // Busca os serviços já existentes
      const existingServices =
        await this.saleRepo.findOpticalServiceItemsBySale(Number(id));

      // Cria um mapa com os novos serviços enviados
      const newItemsMap = new Map(
        body.serviceItems.map((i) => [i.serviceId, i])
      );

      // ➖ Remove serviços que não estão mais na lista enviada
      for (const existing of existingServices) {
        if (!newItemsMap.has(existing.service.id)) {
          await prisma.itemOpticalService.delete({
            where: { id: existing.id },
          });
        }
      }

      // ➕ Adiciona novos serviços (que ainda não existiam)
      for (const dto of body.serviceItems) {
        const alreadyExists = existingServices.some(
          (i) => i.service.id === dto.serviceId
        );
        if (!alreadyExists) {
          await prisma.itemOpticalService.create({
            data: withAuditData(userId, {
              saleId: Number(id),
              serviceId: dto.serviceId,
              tenantId,
              branchId,
            }),
          });
        }
      }
    }

    // 🔹 7. Atualizar protocolo (dados extras opcionais da venda)
    if (body.protocol) {
      // Verifica se já existe protocolo para a venda
      const existingProtocol = await this.saleRepo.findProtocolBySale(
        Number(id)
      );

      if (!existingProtocol) {
        // Se não existir → cria novo
        await prisma.protocol.create({
          data: withAuditData(userId, {
            saleId: Number(id),
            tenantId,
            branchId,
            recordNumber: body.protocol.recordNumber,
            book: body.protocol.book,
            page: body.protocol.page,
            os: body.protocol.os,
          }),
        });
      } else {
        // Se existir → apenas atualiza os dados
        await prisma.protocol.update({
          where: { id: existingProtocol.id },
          data: withAuditData(userId, body.protocol, true),
        });
      }
    }

    // 🔹 8. Atualizar total do pagamento (sincroniza valor final da venda com o pagamento)
    await prisma.payment.update({
      where: { saleId: Number(id) },
      data: withAuditData(
        userId,
        { total: Number(body.total ?? sale.total) },
        true
      ),
    });

    // 🔹 9. Retornar resposta padronizada
    // Busca novamente a venda completa e retorna sucesso.
    const result = await this.saleRepo.findById(Number(id), tenantId);
    return ApiResponse.success("Venda atualizada com sucesso.", req, result);
  }

  // ======================================================
  // LIST SALES (Paginated)
  // ======================================================
  async findAll(req: Request) {
    const user = req.user as any;
    const { tenantId } = user;
    const { page = 1, limit = 10, clientId } = req.query;

    const { items, total } = await this.saleRepo.findAllByTenant(
      tenantId,
      Number(page),
      Number(limit),
      clientId ? Number(clientId) : undefined
    );

    return new PagedResponse(
      "Vendas listadas com sucesso.",
      req,
      items,
      Number(page),
      Number(limit),
      total
    );
  }

  // ======================================================
  // FIND BY ID
  // ======================================================
  async findById(req: Request) {
    const user = req.user as any;
    const { tenantId } = user;
    const { id } = req.params;

    const sale = await this.saleRepo.findById(Number(id), tenantId);
    if (!sale) return ApiResponse.error("Venda não encontrada.", 404, req);

    return ApiResponse.success("Venda encontrada.", req, sale);
  }

  // ======================================================
  // DELETE SALE
  // ======================================================
  async delete(req: Request) {
    const user = req.user as any;
    const { sub: userId, tenantId } = user;
    const { id } = req.params;

    const sale = await this.saleRepo.findById(Number(id), tenantId);
    if (!sale) return ApiResponse.error("Venda não encontrada.", 404, req);

    const payment = await this.paymentRepo.findBySaleId(Number(id));
    if (!payment)
      return ApiResponse.error("Pagamento não encontrado.", 404, req);

    if (payment.status === "CONFIRMED") {
      return ApiResponse.error(
        "Não é possível excluir uma venda já paga.",
        409,
        req
      );
    }

    if (payment.paidAmount > 0) {
      return ApiResponse.error(
        "Venda com pagamento parcial não pode ser excluída.",
        409,
        req
      );
    }

    // Reverter estoque
    const productItems = await this.saleRepo.findProductItemsBySale(Number(id));
    for (const item of productItems) {
      await this.productRepo.update(
        item.productId,
        {
          stockQuantity: (item.product.stockQuantity ?? 0) + item.quantity,
        },
        userId
      );
      await prisma.frameDetails.deleteMany({
        where: { itemProductId: item.id },
      });
      await prisma.itemProduct.delete({ where: { id: item.id } });
    }

    // Remover itens de serviço
    await prisma.itemOpticalService.deleteMany({
      where: { saleId: Number(id) },
    });

    // Remover protocolo
    const protocol = await this.saleRepo.findProtocolBySale(Number(id));
    if (protocol) await prisma.protocol.delete({ where: { id: protocol.id } });

    // Remover pagamento
    await prisma.payment.delete({ where: { saleId: Number(id) } });

    // Soft delete da venda
    await this.saleRepo.softDelete(Number(id), userId);

    return ApiResponse.success("Venda removida com sucesso.", req);
  }
}
