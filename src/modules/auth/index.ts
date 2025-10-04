import { Router } from 'express';
import { registerAdmin, login } from './auth.controller';
import { validateDto } from '../../middlewares/validation.middleware';
import { LoginDto, RegisterAdminDto } from './auth.dto';

export const authRoutes = Router();

authRoutes.post('/register-admin', validateDto(RegisterAdminDto, 'body'), registerAdmin);
authRoutes.post('/login', validateDto(LoginDto, 'body'), login);
