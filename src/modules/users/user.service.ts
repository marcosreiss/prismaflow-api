import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { UserRepository } from "./user.repository";
import { BranchRepository } from "../branches/branch.repository";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

export class UserService {
  private users = new UserRepository();
  private branches = new BranchRepository();

  private canCreate(creator: Role, target: Role) {
    if (creator === "ADMIN")
      return target === "MANAGER" || target === "EMPLOYEE";
    if (creator === "MANAGER") return target === "EMPLOYEE";
    return false;
  }

  async create(
    req: Request,
    dto: {
      name: string;
      email: string;
      password: string;
      role: Role;
      branchId?: string;
    }
  ) {
    const actor = req.user!;
    const { name, email, password, role, branchId } = dto;

    if (!this.canCreate(actor.role, role)) {
      return ApiResponse.error(
        "Acesso negado para criar usuário com esse perfil.",
        403,
        req
      );
    }

    const needsBranch = role === "MANAGER" || role === "EMPLOYEE";
    if (needsBranch && !branchId) {
      return ApiResponse.error(
        "branchId é obrigatório para MANAGER e EMPLOYEE.",
        400,
        req
      );
    }

    let branch = null;
    if (branchId) {
      branch = await this.branches.findByIdInTenant(actor.tenantId, branchId);
      if (!branch) {
        return ApiResponse.error(
          "Filial não encontrada no seu tenant.",
          404,
          req
        );
      }
    }

    if (actor.role === "MANAGER" && role === "EMPLOYEE") {
      if (!actor.branchId || actor.branchId !== branchId) {
        return ApiResponse.error(
          "Gerente só pode criar funcionários na sua própria filial.",
          403,
          req
        );
      }
    }

    const emailTaken = await this.users.findByEmail(email);
    if (emailTaken) {
      return ApiResponse.error(
        "Já existe um usuário com esse e-mail.",
        409,
        req
      );
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await this.users.create({
      name,
      email,
      password: hash,
      role,
      tenantId: actor.tenantId,
      branchId: branch?.id ?? null,
    });

    const { password: _, ...safe } = created;
    return ApiResponse.success("Usuário criado com sucesso.", req, safe);
  }

  async list(req: Request) {
    const actor = req.user!;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    // ADMIN: todos do tenant
    if (actor.role === "ADMIN") {
      const { items, total } = await this.users.findAllByTenant(
        actor.tenantId,
        page,
        limit
      );
      return new PagedResponse(
        "Usuários listados com sucesso.",
        req,
        items,
        page,
        limit,
        total
      );
    }

    // MANAGER: apenas employees da sua branch
    if (actor.role === "MANAGER") {
      if (!actor.branchId) {
        return ApiResponse.error("Gerente sem filial associada.", 400, req);
      }
      const { items, total } = await this.users.findEmployeesByBranch(
        actor.tenantId,
        actor.branchId,
        page,
        limit
      );
      return new PagedResponse(
        "Funcionários listados com sucesso.",
        req,
        items,
        page,
        limit,
        total
      );
    }

    // EMPLOYEE: sem permissão
    return ApiResponse.error("Acesso negado.", 403, req);
  }
}
