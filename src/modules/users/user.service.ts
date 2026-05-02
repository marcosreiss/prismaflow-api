// src/modules/users/user.service.ts
import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { UserRepository } from "./user.repository";
import { BranchRepository } from "../branches/branch.repository";
import { AppError } from "../../utils/app-error";
import { PasswordUtils } from "../../utils/password";
import { Role } from "@prisma/client";

export class UserService {
  private users = new UserRepository();
  private branches = new BranchRepository();

  private canCreate(creator: Role, target: "MANAGER" | "EMPLOYEE") {
    if (creator === "ADMIN") return true;
    if (creator === "MANAGER") return target === "EMPLOYEE";
    return false;
  }

  async create(
    req: Request,
    dto: {
      name: string;
      email: string;
      password: string;
      role: "MANAGER" | "EMPLOYEE";
      branchId?: string;
    },
  ) {
    const actor = req.user;
    if (!actor) throw new AppError("Usuário não autenticado.", 401);

    const { name, email, password, role, branchId } = dto;

    if (!this.canCreate(actor.role, role)) {
      throw new AppError(
        "Acesso negado para criar usuário com esse perfil.",
        403,
      );
    }

    const needsBranch = role === "MANAGER" || role === "EMPLOYEE";
    if (needsBranch && !branchId) {
      throw new AppError(
        "branchId é obrigatório para MANAGER e EMPLOYEE.",
        400,
      );
    }

    let resolvedBranchId: string | null = null;

    if (branchId) {
      const branch = await this.branches.findByIdInTenant(
        actor.tenantId,
        branchId,
      );
      if (!branch)
        throw new AppError("Filial não encontrada no seu tenant.", 404);
      resolvedBranchId = branch.id;
    }

    if (actor.role === "MANAGER") {
      if (!actor.branchId)
        throw new AppError("Gerente sem filial associada no token.", 403);
      if (actor.branchId !== branchId) {
        throw new AppError(
          "Gerente só pode criar funcionários na sua própria filial.",
          403,
        );
      }
    }

    const emailTaken = await this.users.findByEmail(email);
    if (emailTaken)
      throw new AppError("Já existe um usuário com esse e-mail.", 409);

    const hash = await PasswordUtils.hash(password);
    const created = await this.users.create({
      name,
      email,
      password: hash,
      role,
      tenantId: actor.tenantId,
      branchId: resolvedBranchId,
      userId: actor.sub,
    });

    const { password: _, ...safe } = created;
    return ApiResponse.success("Usuário criado com sucesso.", req, safe);
  }

  async list(req: Request) {
    const actor = req.user;
    if (!actor) throw new AppError("Usuário não autenticado.", 401);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));

    if (actor.role === "ADMIN") {
      const { items, total } = await this.users.findAllByTenant(
        actor.tenantId,
        page,
        limit,
      );
      return new PagedResponse(
        "Usuários listados com sucesso.",
        req,
        items,
        page,
        limit,
        total,
      );
    }

    if (actor.role === "MANAGER") {
      if (!actor.branchId)
        throw new AppError("Gerente sem filial associada no token.", 403);
      const { items, total } = await this.users.findEmployeesByBranch(
        actor.tenantId,
        actor.branchId,
        page,
        limit,
      );
      return new PagedResponse(
        "Funcionários listados com sucesso.",
        req,
        items,
        page,
        limit,
        total,
      );
    }

    throw new AppError("Acesso negado.", 403);
  }
}
