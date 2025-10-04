import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface UserPayload {
      sub: string;
      email: string;
      tenantId: string;
      role: Role;
      branchId?: string | null;
      iat?: number;
      exp?: number;
    }
    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
