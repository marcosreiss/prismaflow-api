import { Router } from 'express';
import { registerAdmin } from './auth.controller';

export const authRoutes = Router();

authRoutes.post('/register-admin', registerAdmin);
