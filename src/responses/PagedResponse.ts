import { Request } from "express";
import { ApiResponse } from "./ApiResponse";

export interface PageData<T> {
  currentPage: number;
  totalPages: number;
  totalElements: number;
  limit: number;
  content: T[];
  stats?: any; // ✅ Adicionar campo stats opcional
}

export class PagedResponse<T> extends ApiResponse<PageData<T>> {
  constructor(
    message: string,
    req: Request,
    items: T[],
    page: number,
    limit: number,
    total: number,
    stats?: any // ✅ Adicionar parâmetro stats opcional
  ) {
    const totalPages = Math.ceil(total / limit);

    const data: PageData<T> = {
      currentPage: page,
      totalPages,
      totalElements: total,
      limit,
      content: items,
    };

    // ✅ Incluir stats se fornecido
    if (stats) {
      data.stats = stats;
    }

    super(200, message, req, data);
  }
}
