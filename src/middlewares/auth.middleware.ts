import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiResponse } from "../responses/ApiResponse";

interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  branchId?: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  iat?: number;
  exp?: number;
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    const resp = ApiResponse.error("Não autenticado.", 401, req);
    return res.status(401).json(resp);
  }

  const token = header.substring(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload; // agora tipado corretamente
    next();
  } catch {
    const resp = ApiResponse.error("Token inválido ou expirado.", 401, req);
    return res.status(401).json(resp);
  }
}
