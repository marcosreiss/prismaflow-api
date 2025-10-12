// src/modules/sales/sale.service.ts
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
import logger from "../../utils/logger";

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
    logger.debug("🟦 [SaleService] Iniciando criação de venda", {
      body: req.body,
    });
    const user = req.user as any;
    const { sub: userId, tenantId, branchId } = user;
    const body = req.body;
    const errors: string[] = [];

    try {
      // 1️⃣ Cliente
      logger.debug("🔹 [SaleService] Buscando cliente", {
        clientId: body.clientId,
      });
      const client = await this.clientRepo.findById(body.clientId, tenantId);
      if (!client) errors.push("Cliente não encontrado.");

      // 2️⃣ Itens obrigatórios
      const hasItems =
        (body.productItems && body.productItems.length > 0) ||
        (body.serviceItems && body.serviceItems.length > 0);
      if (!hasItems)
        errors.push("É necessário pelo menos um produto ou serviço.");

      if (errors.length) {
        logger.warn("⚠️ [SaleService] Erros de validação ao criar venda", {
          errors,
        });
        return ApiResponse.error(errors.join("; "), 400, req);
      }

      // 3️⃣ Criar venda
      logger.debug("🧩 [SaleService] Criando registro de venda", {
        tenantId,
        branchId,
      });
      const sale = await this.saleRepo.create(
        {
          clientId: body.clientId,
          tenantId,
          branchId,
          prescriptionId: body.prescriptionId,
          subtotal: body.subtotal,
          discount: body.discount ?? 0,
          total: body.total,
          notes: body.notes,
          isActive: true,
        },
        userId
      );
      logger.info("✅ [SaleService] Venda criada", { saleId: sale.id });

      // 4️⃣ Protocolo (opcional)
      if (body.protocol) {
        logger.debug("📘 [SaleService] Criando protocolo vinculado", {
          saleId: sale.id,
        });
        await this.saleRepo.createProtocol(
          {
            saleId: sale.id,
            tenantId,
            branchId,
            recordNumber: body.protocol.recordNumber,
            book: body.protocol.book,
            page: body.protocol.page,
            os: body.protocol.os,
            isActive: true,
          },
          userId
        );
      }

      // 5️⃣ Itens de produto
      if (body.productItems?.length) {
        logger.debug("📦 [SaleService] Criando itens de produto", {
          count: body.productItems.length,
        });
        for (const item of body.productItems) {
          const product = await this.productRepo.findById(item.productId);
          if (!product) {
            logger.warn("⚠️ [SaleService] Produto não encontrado", {
              productId: item.productId,
            });
            return ApiResponse.error(
              `Produto não encontrado: ${item.productId}`,
              404,
              req
            );
          }

          if ((product.stockQuantity ?? 0) < item.quantity) {
            logger.warn("⚠️ [SaleService] Estoque insuficiente", {
              productId: product.id,
            });
            return ApiResponse.error(
              `Estoque insuficiente para ${product.name}`,
              409,
              req
            );
          }

          // Baixa de estoque
          await this.productRepo.update(
            product.id,
            { stockQuantity: (product.stockQuantity ?? 0) - item.quantity },
            userId
          );

          logger.debug("🧮 [SaleService] Estoque atualizado", {
            productId: product.id,
            newStock: (product.stockQuantity ?? 0) - item.quantity,
          });

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
          logger.debug("✅ [SaleService] Item de produto criado", {
            itemProductId: itemProduct.id,
          });

          // Frame details se necessário
          if (product.category === "FRAME" && item.frameDetails) {
            logger.debug("🖼️ [SaleService] Criando detalhes de armação", {
              itemProductId: itemProduct.id,
            });
            await prisma.frameDetails.create({
              data: {
                itemProductId: itemProduct.id,
                material: item.frameDetails.material,
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
        logger.debug("🧰 [SaleService] Criando itens de serviço", {
          count: body.serviceItems.length,
        });
        for (const item of body.serviceItems) {
          const service = await this.opticalRepo.findById(item.serviceId);
          if (!service) {
            logger.warn("⚠️ [SaleService] Serviço não encontrado", {
              serviceId: item.serviceId,
            });
            return ApiResponse.error(
              `Serviço não encontrado: ${item.serviceId}`,
              404,
              req
            );
          }

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
      logger.debug("💰 [SaleService] Criando pagamento inicial", {
        saleId: sale.id,
      });
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

      logger.info("✅ [SaleService] Venda criada com sucesso", {
        saleId: sale.id,
      });
      return ApiResponse.success("Venda criada com sucesso.", req, {
        saleId: sale.id,
        clientId: sale.clientId,
        precripitonId: sale.prescriptionId,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        payment,
      });
    } catch (error: any) {
      logger.error("❌ [SaleService] Erro ao criar venda", {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  // ======================================================
  // UPDATE SALE
  // ======================================================
  async updateSale(req: Request) {
    logger.debug("🟨 [SaleService] Iniciando atualização de venda", {
      id: req.params.id,
      body: req.body,
    });
    const { id } = req.params;
    const body = req.body as UpdateSaleDto;
    const userId = req.user?.sub;
    const tenantId = req.user?.tenantId!;
    const branchId = req.user?.branchId!;

    try {
      const sale = await this.saleRepo.findById(Number(id), tenantId);
      if (!sale) throw new Error(`Venda ${id} não encontrada`);

      const payment = await prisma.payment.findFirst({
        where: { saleId: Number(id) },
      });
      if (!payment) throw new Error("Pagamento não encontrado para esta venda.");
      if (payment.status !== "PENDING" || (payment.paidAmount ?? 0) > 0)
        throw new Error("Venda não pode ser editada com pagamento iniciado.");

      if (body.clientId) {
        const client = await this.clientRepo.findById(body.clientId, tenantId);
        if (!client) throw new Error("Cliente não encontrado.");
      }

      // 🔥 USAR TRANSAÇÃO PARA ATOMICIDADE
      return await prisma.$transaction(async (tx) => {
        // 1️⃣ Atualizar venda básica
        const updatedSale = await this.saleRepo.update(
          Number(id),
          {
            clientId: body.clientId ?? sale.clientId,
            subtotal: body.subtotal ?? sale.subtotal ?? 0,
            discount: body.discount ?? sale.discount ?? 0,
            total: body.total ?? sale.total ?? 0,
            notes: body.notes ?? sale.notes,
            isActive: body.isActive ?? sale.isActive,
          },
          userId
        );

        // 2️⃣ VALIDAÇÃO ANTECIPADA DOS NOVOS PRODUTOS
        if (body.productItems !== undefined && body.productItems.length > 0) {
          for (const item of body.productItems) {
            // ✅ VALIDAR se quantity existe e é válida
            const quantity = item.quantity ?? 1;
            if (quantity < 1) {
              throw new Error(`Quantidade deve ser pelo menos 1 para o produto ${item.productId}`);
            }

            const product = await tx.product.findFirst({
              where: { id: item.productId, tenantId }
            });
            if (!product) {
              throw new Error(`Produto ${item.productId} não encontrado`);
            }
          }
        }

        // 3️⃣ ATUALIZAR ITENS DE PRODUTO (ESTOQUE INTELIGENTE)
        if (body.productItems !== undefined) {
          logger.debug("📦 [SaleService] Atualizando itens de produto", {
            count: body.productItems.length,
          });

          // Buscar itens antigos
          const oldProductItems = await this.saleRepo.findProductItemsBySale(Number(id));
          const newProductIds = body.productItems.map(item => item.productId);

          // 🔄 RESTAURAR estoque APENAS dos itens que SERÃO REMOVIDOS
          for (const oldItem of oldProductItems) {
            // Se o produto NÃO está na nova lista, restaura estoque
            if (!newProductIds.includes(oldItem.productId)) {
              await tx.product.update({
                where: { id: oldItem.productId },
                data: {
                  stockQuantity: { increment: oldItem.quantity },
                  updatedById: userId
                }
              });
              logger.debug("📥 [SaleService] Estoque restaurado para produto removido", {
                productId: oldItem.productId,
                quantity: oldItem.quantity
              });
            }
          }

          // 🗑️ REMOVER todos os itens antigos (incluindo frameDetails)
          await tx.frameDetails.deleteMany({
            where: { itemProduct: { saleId: Number(id) } }
          });
          await tx.itemProduct.deleteMany({
            where: { saleId: Number(id) }
          });

          // ➕ CRIAR novos itens com GESTÃO INTELIGENTE DE ESTOQUE
          if (body.productItems.length > 0) {
            for (const item of body.productItems) {
              const product = await tx.product.findFirst({
                where: { id: item.productId, tenantId }
              });
              if (!product) throw new Error(`Produto ${item.productId} não encontrado`);

              // ✅ GARANTIR que quantity existe
              const quantity = item.quantity ?? 1;

              // 🔍 IDENTIFICAR se é item NOVO ou EXISTENTE
              const oldItem = oldProductItems.find(old => old.productId === item.productId);
              const isNewItem = !oldItem;
              const isModifiedItem = oldItem && oldItem.quantity !== quantity;

              // 📊 CALCULAR ajuste de estoque necessário
              if (isNewItem) {
                // NOVO PRODUTO: Baixar estoque completo
                if ((product.stockQuantity ?? 0) < quantity) {
                  throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stockQuantity}, Necessário: ${quantity}`);
                }

                await tx.product.update({
                  where: { id: product.id },
                  data: {
                    stockQuantity: { decrement: quantity },
                    updatedById: userId
                  }
                });
                logger.debug("🆕 [SaleService] Estoque baixado para novo produto", {
                  productId: product.id,
                  quantity: quantity
                });

              } else if (isModifiedItem) {
                // PRODUTO EXISTENTE COM QUANTIDADE MODIFICADA
                const quantityDifference = quantity - oldItem.quantity;

                if (quantityDifference > 0) {
                  // AUMENTOU quantidade: baixar estoque adicional
                  if ((product.stockQuantity ?? 0) < quantityDifference) {
                    throw new Error(`Estoque insuficiente para aumentar quantidade de ${product.name}. Disponível: ${product.stockQuantity}, Necessário adicional: ${quantityDifference}`);
                  }

                  await tx.product.update({
                    where: { id: product.id },
                    data: {
                      stockQuantity: { decrement: quantityDifference },
                      updatedById: userId
                    }
                  });
                  logger.debug("📈 [SaleService] Estoque baixado para quantidade aumentada", {
                    productId: product.id,
                    quantity: quantityDifference
                  });

                } else if (quantityDifference < 0) {
                  // DIMINUIU quantidade: restaurar estoque
                  const quantityToRestore = Math.abs(quantityDifference);
                  await tx.product.update({
                    where: { id: product.id },
                    data: {
                      stockQuantity: { increment: quantityToRestore },
                      updatedById: userId
                    }
                  });
                  logger.debug("📉 [SaleService] Estoque restaurado para quantidade reduzida", {
                    productId: product.id,
                    quantity: quantityToRestore
                  });
                }
              }

              // 🆕 CRIAR item de produto
              const itemProduct = await tx.itemProduct.create({
                data: {
                  saleId: Number(id),
                  productId: item.productId,
                  quantity: quantity,
                  tenantId,
                  branchId,
                  createdById: userId,
                  updatedById: userId,
                },
              });

              // 🖼️ Frame details se necessário
              if (product.category === "FRAME" && item.frameDetails) {
                await tx.frameDetails.create({
                  data: {
                    itemProductId: itemProduct.id,
                    material: item.frameDetails.material,
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
        }

        // 4️⃣ ATUALIZAR ITENS DE SERVIÇO
        if (body.serviceItems !== undefined) {
          logger.debug("🧰 [SaleService] Atualizando itens de serviço", {
            count: body.serviceItems.length,
          });

          // VALIDAR serviços antes de remover
          if (body.serviceItems.length > 0) {
            for (const item of body.serviceItems) {
              const service = await tx.opticalService.findFirst({
                where: { id: item.serviceId, tenantId }
              });
              if (!service) throw new Error(`Serviço ${item.serviceId} não encontrado`);
            }
          }

          // 🗑️ REMOVER itens antigos
          await tx.itemOpticalService.deleteMany({
            where: { saleId: Number(id) }
          });

          // ➕ CRIAR novos itens
          if (body.serviceItems.length > 0) {
            for (const item of body.serviceItems) {
              await tx.itemOpticalService.create({
                data: {
                  saleId: Number(id),
                  serviceId: item.serviceId,
                  tenantId,
                  branchId,
                  createdById: userId,
                  updatedById: userId,
                },
              });
            }
            logger.debug("✅ [SaleService] Itens de serviço criados", {
              count: body.serviceItems.length
            });
          }
        }

        // 5️⃣ ATUALIZAR PROTOCOLO
        if (body.protocol) {
          logger.debug("📘 [SaleService] Atualizando ou criando protocolo", {
            saleId: id,
          });
          const existingProtocol = await this.saleRepo.findProtocolBySale(Number(id));
          if (!existingProtocol) {
            await this.saleRepo.createProtocol(
              {
                saleId: Number(id),
                tenantId,
                branchId,
                recordNumber: body.protocol.recordNumber,
                book: body.protocol.book,
                page: body.protocol.page,
                os: body.protocol.os,
              },
              userId
            );
          } else {
            await this.saleRepo.updateProtocol(
              existingProtocol.id,
              {
                recordNumber: body.protocol.recordNumber,
                book: body.protocol.book,
                page: body.protocol.page,
                os: body.protocol.os,
              },
              userId
            );
          }
        }

        // 6️⃣ ATUALIZAR PAGAMENTO (CORRIGIDO)
        await tx.payment.update({
          where: { saleId: Number(id) },
          data: {
            total: Number(body.total ?? sale.total ?? 0),
            discount: body.discount ?? sale.discount ?? 0, // ← CORREÇÃO
            updatedById: userId,
            updatedAt: new Date()
          },
        });

        // 7️⃣ BUSCAR VENDA ATUALIZADA (CORRIGIDO)
        const result = await this.saleRepo.findById(Number(id), tenantId);

        // ✅ VALIDAR que result não é null
        if (!result) {
          throw new Error("Venda não encontrada após atualização");
        }

        logger.info("✅ [SaleService] Venda atualizada com sucesso", {
          saleId: id,
          productItemsCount: result.productItems.length,
          serviceItemsCount: result.serviceItems.length
        });

        return ApiResponse.success("Venda atualizada com sucesso.", req, result);
      });
    } catch (error: any) {
      logger.error("❌ [SaleService] Erro ao atualizar venda", {
        message: error.message,
        stack: error.stack,
        saleId: id
      });
      throw error;
    }
  }

  // ======================================================
  // LIST SALES
  // ======================================================
  async findAll(req: Request) {
    logger.debug("📋 [SaleService] Listando vendas", { query: req.query });
    try {
      const user = req.user as any;
      const { tenantId } = user;
      const { page = 1, limit = 10, clientId } = req.query;

      const { items, total } = await this.saleRepo.findAllByTenant(
        tenantId,
        Number(page),
        Number(limit),
        clientId ? Number(clientId) : undefined
      );

      logger.info("✅ [SaleService] Vendas listadas", { total });
      return new PagedResponse(
        "Vendas listadas com sucesso.",
        req,
        items,
        Number(page),
        Number(limit),
        total
      );
    } catch (error: any) {
      logger.error("❌ [SaleService] Erro ao listar vendas", {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  // ======================================================
  // FIND BY ID
  // ======================================================
  async findById(req: Request) {
    logger.debug("🔍 [SaleService] Buscando venda por ID", {
      id: req.params.id,
    });
    try {
      const user = req.user as any;
      const { tenantId } = user;
      const { id } = req.params;

      const sale = await this.saleRepo.findById(Number(id), tenantId);
      if (!sale) {
        logger.warn("⚠️ [SaleService] Venda não encontrada", { id });
        return ApiResponse.error("Venda não encontrada.", 404, req);
      }

      logger.info("✅ [SaleService] Venda encontrada", { saleId: id });
      return ApiResponse.success("Venda encontrada.", req, sale);
    } catch (error: any) {
      logger.error("❌ [SaleService] Erro ao buscar venda", {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  // ======================================================
  // DELETE SALE
  // ======================================================
  async delete(req: Request) {
    logger.debug("🗑️ [SaleService] Iniciando exclusão de venda", {
      id: req.params.id,
    });
    const user = req.user as any;
    const { sub: userId, tenantId } = user;
    const { id } = req.params;

    try {
      const sale = await this.saleRepo.findById(Number(id), tenantId);
      if (!sale) return ApiResponse.error("Venda não encontrada.", 404, req);

      const payment = await this.paymentRepo.findBySaleId(Number(id));
      if (!payment)
        return ApiResponse.error("Pagamento não encontrado.", 404, req);

      if (payment.status === "CONFIRMED" || payment.paidAmount > 0) {
        logger.warn("⚠️ [SaleService] Tentativa de exclusão de venda paga", {
          saleId: id,
        });
        return ApiResponse.error(
          "Não é possível excluir uma venda já paga ou parcialmente paga.",
          409,
          req
        );
      }

      const productItems = await this.saleRepo.findProductItemsBySale(
        Number(id)
      );
      logger.debug("📦 [SaleService] Restaurando estoque de produtos", {
        count: productItems.length,
      });
      for (const item of productItems) {
        await this.productRepo.update(
          item.productId,
          { stockQuantity: (item.product.stockQuantity ?? 0) + item.quantity },
          userId
        );
        await prisma.frameDetails.deleteMany({
          where: { itemProductId: item.id },
        });
        await prisma.itemProduct.delete({ where: { id: item.id } });
      }

      await prisma.itemOpticalService.deleteMany({
        where: { saleId: Number(id) },
      });

      const protocol = await this.saleRepo.findProtocolBySale(Number(id));
      if (protocol)
        await prisma.protocol.delete({ where: { id: protocol.id } });

      await prisma.payment.delete({ where: { saleId: Number(id) } });
      await this.saleRepo.softDelete(Number(id), userId);

      logger.info("✅ [SaleService] Venda removida com sucesso", {
        saleId: id,
      });
      return ApiResponse.success("Venda removida com sucesso.", req);
    } catch (error: any) {
      logger.error("❌ [SaleService] Erro ao excluir venda", {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
