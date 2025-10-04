import { Request } from 'express';
import { ApiResponse } from './ApiResponse';

export interface PageData<T> {
  currentPage: number;
  totalPages: number;
  totalElements: number;
  content: T[];
}

export class PagedResponse<T> extends ApiResponse<PageData<T>> {
  constructor(message: string, req: Request, data: PageData<T>) {
    super(200, message, req, data);
  }
}
