import { Request } from "express";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../../responses/ApiResponse";
import { AuthRepository } from "./auth.repository";
import { env } from "../../config/env";
import { PasswordUtils } from "../../utils/password";
import {
  RegisterAdminDto,
  LoginDto,
  ChangePasswordDto,
  RegisterUserDto,
  SelectBranchDto,
} from "./dtos/auth.dto";

export class AuthService {
  private repository = new AuthRepository();

  async registerAdmin(req: Request, dto: RegisterAdminDto) {
    const tenant = await this.repository.createTenantWithAdmin(dto, req);
    return ApiResponse.success(
      "Ótica e administrador criados com sucesso.",
      req,
      tenant
    );
  }

  async registerUser(req: Request, dto: RegisterUserDto) {
    const currentUserId = req.user?.sub;

    if (!currentUserId) {
      return ApiResponse.error("Usuário não autenticado.", 401, req);
    }

    if (req.user?.role !== "ADMIN") {
      return ApiResponse.error(
        "Apenas administradores podem cadastrar novos usuários.",
        403,
        req
      );
    }

    dto.createdById = currentUserId;
    const user = await this.repository.createUser(dto, req);

    return ApiResponse.success("Usuário criado com sucesso.", req, user);
  }

  // 🔹 Novo fluxo de login com token temporário e seleção de branch
  async login(req: Request, dto: LoginDto) {
    const user = await this.repository.findUserByEmail(dto.email);
    if (!user) {
      return ApiResponse.error("Usuário não encontrado.", 404, req);
    }

    const isValid = await PasswordUtils.compare(dto.password, user.password);
    if (!isValid) {
      return ApiResponse.error("Credenciais inválidas.", 401, req);
    }

    const secret = env.JWT_SECRET || "chave-padrao";

    // 🔹 Se for ADMIN e não tiver branchId, iniciar fluxo de seleção de filial
    if (user.role === "ADMIN" && !user.branchId) {
      const branches = await this.repository.findBranchesByTenantId(
        user.tenantId
      );

      // Se só houver uma filial, faz login direto
      if (branches.length === 1) {
        const branch = branches[0];
        const token = jwt.sign(
          {
            sub: user.id,
            email: user.email,
            tenantId: user.tenantId,
            branchId: branch.id,
            role: user.role,
          },
          secret,
          { expiresIn: "2h" }
        );

        const { password, ...userSafe } = user;

        return ApiResponse.success(
          "Login realizado com sucesso (filial única detectada).",
          req,
          { ...userSafe, branch },
          token
        );
      }

      // Caso contrário, gera token temporário (5 min)
      const tempToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
          isTemp: true,
        },
        secret,
        { expiresIn: "5m" }
      );

      return ApiResponse.success("Selecione a filial para continuar.", req, {
        branches,
        tempToken,
      });
    }

    // 🔹 Login normal (usuário comum ou admin com branchId definido)
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
      },
      secret,
      { expiresIn: "2h" }
    );

    const { password, ...userSafe } = user;

    return ApiResponse.success(
      "Login realizado com sucesso.",
      req,
      userSafe,
      token
    );
  }

  // 🔹 Novo método: seleção de filial (branch-selection)
  async selectBranch(req: Request, dto: SelectBranchDto) {
    const secret = env.JWT_SECRET || "chave-padrao";
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return ApiResponse.error("Token temporário não informado.", 401, req);
    }

    const token = header.substring(7);

    try {
      const payload = jwt.verify(token, secret) as any;

      if (!payload.isTemp) {
        return ApiResponse.error(
          "Token inválido para seleção de filial.",
          401,
          req
        );
      }

      const user = await this.repository.findUserById(payload.sub);
      if (!user) {
        return ApiResponse.error("Usuário não encontrado.", 404, req);
      }

      const finalToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          tenantId: user.tenantId,
          branchId: dto.branchId,
          role: user.role,
        },
        secret,
        { expiresIn: "2h" }
      );

      const { password, ...userSafe } = user;

      return ApiResponse.success(
        "Login completado com sucesso.",
        req,
        userSafe,
        finalToken
      );
    } catch {
      return ApiResponse.error(
        "Token temporário inválido ou expirado.",
        401,
        req
      );
    }
  }

  async changePassword(req: Request, dto: ChangePasswordDto) {
    const userId = req.user?.sub;
    if (!userId) return ApiResponse.error("Usuário não autenticado.", 401, req);

    const email = req.user?.email;
    if (!email) return ApiResponse.error("Usuário não autenticado.", 401, req);

    const user = await this.repository.findUserByEmail(email);
    if (!user) return ApiResponse.error("Usuário não encontrado.", 404, req);

    const valid = await PasswordUtils.compare(
      dto.currentPassword,
      user.password
    );
    if (!valid) return ApiResponse.error("Senha atual incorreta.", 400, req);

    await this.repository.updatePassword(user.id, dto.newPassword);
    return ApiResponse.success("Senha alterada com sucesso.", req);
  }
}
