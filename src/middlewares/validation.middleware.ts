import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../responses/ApiResponse";

type ValidationSource = "body" | "query" | "params";

export function validateDto(dtoClass: any, source: ValidationSource = "body") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Pega a origem (body, query ou params)
      const payload = req[source];

      // Converte para classe DTO
      const dtoObject = plainToInstance(dtoClass, payload);

      // Valida campos com class-validator
      const errors = await validate(dtoObject, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (errors.length > 0) {
        const messages = errors.flatMap((err) =>
          Object.values(err.constraints || {})
        );

        const response = ApiResponse.error(
          `Erro de validação: ${messages.join(", ")}`,
          400,
          req
        );
        return res.status(400).json(response);
      }

      // Sobrescreve o conteúdo validado (garante tipagem e limpeza)
      req[source] = dtoObject;
      next();
    } catch (error) {
      next(error);
    }
  };
}
