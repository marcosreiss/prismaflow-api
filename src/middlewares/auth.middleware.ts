import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiResponse } from "../responses/ApiResponse";

/**
 * Payload esperado dentro do token JWT
 */
export interface JwtPayload {
  sub: string; // ID do usuário
  email: string;
  tenantId: string;
  branchId: string; // ✅ agora obrigatório
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  iat?: number;
  exp?: number;
}

/**
 * Middleware de autenticação JWT
 */
export function authGuard(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    const resp = ApiResponse.error("Não autenticado.", 401, req);
    return res.status(401).json(resp);
  }

  const token = header.substring(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // ✅ injeta o usuário autenticado na requisição
    req.user = {
      sub: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      branchId: payload.branchId, // ✅ agora sempre existe
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    };

    next();
  } catch (error) {
    const resp = ApiResponse.error("Token inválido ou expirado.", 401, req);
    return res.status(401).json(resp);
  }
}
