import { Request, Response } from "express";
import { SaleService } from "./sale.service";

const service = new SaleService();

// 🔹 Criar venda
export async function createSale(req: Request, res: Response) {
  try {
    const result = await service.create(req);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

// 🔹 Atualizar venda
export async function updateSale(req: Request, res: Response) {
  try {
    const result = await service.updateSale(req);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

// 🔹 Listar vendas (paginado)
export async function listSales(req: Request, res: Response) {
  try {
    const result = await service.findAll(req);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

// 🔹 Buscar venda por ID
export async function getSaleById(req: Request, res: Response) {
  try {
    const result = await service.findById(req);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

// 🔹 Excluir venda
export async function deleteSale(req: Request, res: Response) {
  try {
    const result = await service.delete(req);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}
