import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../responses/ApiResponse";
import { Role } from "@prisma/client";

export function requireRoles(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      const resp = ApiResponse.error("Acesso negado.", 403, req);
      return res.status(403).json(resp);
    }
    next();
  };
}
