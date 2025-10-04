import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../responses/ApiResponse';

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('🔥 Error:', err);

  const status = err.status || 500;
  const message = err.message || 'Erro interno no servidor.';

  const response = ApiResponse.error(message, status, req);
  res.status(status).json(response);
}
