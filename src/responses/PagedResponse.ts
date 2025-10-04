import { Request } from "express";
import { ApiResponse } from "./ApiResponse";

export interface PageData<T> {
  currentPage: number;
  totalPages: number;
  totalElements: number;
  limit: number;
  content: T[];
}

export class PagedResponse<T> extends ApiResponse<PageData<T>> {
  constructor(
    message: string,
    req: Request,
    items: T[],
    page: number,
    limit: number,
    total: number
  ) {
    const totalPages = Math.ceil(total / limit);

    const data: PageData<T> = {
      currentPage: page,
      totalPages,
      totalElements: total,
      limit,
      content: items,
    };

    super(200, message, req, data);
  }
}
