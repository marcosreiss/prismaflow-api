import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { branchRoutes } from '../modules/branches/branch.routes';
import { userRoutes } from '../modules/users/user.routes';

export const router = Router();

router.get('/', (req, res) => {
  res.send('API funcionando!');
});

router.use('/auth', authRoutes);
router.use('/branches', branchRoutes);
router.use('/users', userRoutes);
