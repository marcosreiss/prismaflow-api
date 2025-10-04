import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { RegisterAdminDto } from './auth.dto';

const service = new AuthService();

export const registerAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto: RegisterAdminDto = req.body;
    const result = await service.registerAdmin(req, dto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};
