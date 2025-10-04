import { Router } from 'express';
import { createUser } from './user.controller';
import { authGuard } from '../../middlewares/auth.middleware';
import { validateDto } from '../../middlewares/validation.middleware';
import { CreateUserDto } from './dtos/create-user.dto';

export const userRoutes = Router();

userRoutes.post(
  '/',
  authGuard,                // precisa estar logado
  validateDto(CreateUserDto, 'body'),
  createUser
);
