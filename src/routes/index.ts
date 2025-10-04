import { Router } from 'express';
import { getUsers } from '../controllers/user.controller';

export const router = Router();

router.get('/', (req, res) => {
  res.send('API funcionando!');
});

router.get('/users', getUsers);
