import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiResponse } from "../responses/ApiResponse";

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    const resp = ApiResponse.error("Não autenticado.", 401, req);
    return res.status(401).json(resp);
  }

  const token = header.substring(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    // payload: { sub, email, tenantId, role, branchId? }
    // @ts-expect-error - atribuição custom no Request
    req.user = payload;
    next();
  } catch {
    const resp = ApiResponse.error("Token inválido ou expirado.", 401, req);
    return res.status(401).json(resp);
  }
}
