import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../responses/ApiResponse";

export function validateDto(dtoClass: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoObject = plainToInstance(dtoClass, req.body);
    const errors = await validate(dtoObject, { whitelist: true });

    if (errors.length > 0) {
      const messages = errors.flatMap((err) =>
        Object.values(err.constraints || {})
      );
      const response = ApiResponse.error(
        `Validation failed: ${messages.join(", ")}`,
        400,
        req
      );
      return res.status(400).json(response);
    }

    req.body = dtoObject;
    next();
  };
}
