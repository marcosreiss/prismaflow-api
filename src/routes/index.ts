import { Router } from 'express';
import { authRoutes } from '../modules/auth';
import { branchRoutes } from '../modules/branches';
import { userRoutes } from '../modules/users';

export const router = Router();

router.get('/', (req, res) => {
  res.send('API funcionando!');
});

router.use('/auth', authRoutes);
router.use('/branches', branchRoutes);
router.use('/users', userRoutes);
