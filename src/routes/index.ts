import { Router } from 'express';
import { getUsers } from '../controllers/user.controller';
import { authRoutes } from '../modules/auth';

export const router = Router();

router.get('/', (req, res) => {
  res.send('API funcionando!');
});

router.use('/auth', authRoutes);
