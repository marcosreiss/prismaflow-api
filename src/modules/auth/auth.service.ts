// src/modules/auth/auth.service.ts
import { Request } from "express";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../../responses/ApiResponse";
import { AuthRepository } from "./auth.repository";
import { AppError } from "../../utils/app-error";
import { env } from "../../config/env";
import { PasswordUtils } from "../../utils/password";
import {
  RegisterAdminDto,
  LoginDto,
  ChangePasswordDto,
  RegisterUserDto,
  SelectBranchDto,
} from "./auth.dto";

export class AuthService {
  private repository = new AuthRepository();

  async registerAdmin(req: Request, dto: RegisterAdminDto) {
    const result = await this.repository.createTenantWithAdmin(dto);
    return ApiResponse.success(
      "Ótica e administrador criados com sucesso.",
      req,
      result,
    );
  }

  async registerUser(req: Request, dto: RegisterUserDto) {
    const currentUserId = req.user?.sub;
    if (!currentUserId) throw new AppError("Usuário não autenticado.", 401);

    // Proteção extra: garante que só ADMIN chega aqui (a rota já tem requireRoles, mas defense-in-depth)
    if (req.user?.role !== "ADMIN")
      throw new AppError(
        "Apenas administradores podem cadastrar usuários.",
        403,
      );

    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    if (!branchId) throw new AppError("Filial não identificada no token.", 403);

    const user = await this.repository.createUser({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role,
      tenantId,
      branchId,
      createdById: currentUserId,
    });

    return ApiResponse.success("Usuário criado com sucesso.", req, user);
  }

  async login(req: Request, dto: LoginDto) {
    const user = await this.repository.findUserByEmail(dto.email);
    if (!user) throw new AppError("Credenciais inválidas.", 401);

    const isValid = await PasswordUtils.compare(dto.password, user.password);
    if (!isValid) throw new AppError("Credenciais inválidas.", 401);

    // ADMIN sem branchId fixa: fluxo de seleção de filial
    if (user.role === "ADMIN" && !user.branchId) {
      return this.handleAdminWithoutBranch(req, user);
    }

    const token = this.signToken({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      branchId: user.branchId!,
      role: user.role,
    });

    const { password, ...userSafe } = user;
    return ApiResponse.success(
      "Login realizado com sucesso!",
      req,
      userSafe,
      token,
    );
  }

  private async handleAdminWithoutBranch(
    req: Request,
    user: NonNullable<Awaited<ReturnType<AuthRepository["findUserByEmail"]>>>,
  ) {
    const branches = await this.repository.findBranchesByTenantId(
      user.tenantId,
    );

    if (branches.length === 1) {
      const token = this.signToken({
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        branchId: branches[0].id,
        role: user.role,
      });
      const { password, ...userSafe } = user;
      return ApiResponse.success(
        "Login realizado com sucesso!",
        req,
        { ...userSafe, branchId: branches[0].id },
        token,
      );
    }

    const tempToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        isTemp: true,
      },
      env.JWT_SECRET,
      { expiresIn: "5m" },
    );

    return ApiResponse.success("Selecione a filial para continuar.", req, {
      branches,
      tempToken,
    });
  }

  async selectBranch(req: Request, dto: SelectBranchDto) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new AppError("Token temporário não informado.", 401);

    const token = header.substring(7);
    let payload: any;

    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new AppError("Token temporário inválido ou expirado.", 401);
    }

    if (!payload.isTemp)
      throw new AppError("Token inválido para seleção de filial.", 401);

    const user = await this.repository.findUserById(payload.sub);
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    // Valida que a filial selecionada pertence ao tenant do usuário
    const branches = await this.repository.findBranchesByTenantId(
      user.tenantId,
    );
    const validBranch = branches.find((b) => b.id === dto.branchId);
    if (!validBranch)
      throw new AppError("Filial inválida ou não pertence ao seu tenant.", 403);

    const finalToken = this.signToken({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      branchId: dto.branchId,
      role: user.role,
    });

    const { password, ...userSafe } = user;
    return ApiResponse.success(
      "Login completado com sucesso.",
      req,
      userSafe,
      finalToken,
    );
  }

  async changePassword(req: Request, dto: ChangePasswordDto) {
    const userId = req.user?.sub;
    if (!userId) throw new AppError("Usuário não autenticado.", 401);

    const email = req.user?.email;
    if (!email) throw new AppError("Usuário não autenticado.", 401);

    const user = await this.repository.findUserByEmail(email);
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    const valid = await PasswordUtils.compare(
      dto.currentPassword,
      user.password,
    );
    if (!valid) throw new AppError("Senha atual incorreta.", 401);

    await this.repository.updatePassword(user.id, dto.newPassword);
    return ApiResponse.success("Senha alterada com sucesso.", req);
  }

  private signToken(payload: {
    sub: string;
    email: string;
    tenantId: string;
    branchId: string;
    role: string;
  }) {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "2h" });
  }
}
