import { Router } from 'express';
import { registerAdmin } from './auth.controller';
import { validateDto } from '../../middlewares/validation.middleware';
import { RegisterAdminDto } from './auth.dto';

export const authRoutes = Router();

authRoutes.post('/register-admin', validateDto(RegisterAdminDto), registerAdmin);
