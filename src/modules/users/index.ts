import { Router } from 'express';
import { getUserById } from './user.controller';
import { validateDto } from '../../middlewares/validation.middleware';
import { GetUserParamDto } from './dtos/get-user-param.dto';

export const userRoutes = Router();

userRoutes.get('/:id', validateDto(GetUserParamDto, 'params'), getUserById);
