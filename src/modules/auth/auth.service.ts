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

    // Garante que o usuário logado é ADMIN
    if (req.user?.role !== "ADMIN") {
      return ApiResponse.error(
        "Apenas administradores podem cadastrar novos usuários.",
        403,
        req
      );
    }

    // Adiciona auditoria
    dto.createdById = currentUserId;
    const user = await this.repository.createUser(dto, req);

    return ApiResponse.success("Usuário criado com sucesso.", req, user);
  }

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
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
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
