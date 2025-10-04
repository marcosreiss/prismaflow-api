import express from 'express';
import { router } from './routes';
import { setupMiddlewares } from './middlewares/global.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { env } from './config/env';

const app = express();

setupMiddlewares(app);

// Rotas
app.use('/api', router);

// Middleware global de erros (deve vir DEPOIS das rotas)
app.use(errorMiddleware);

app.listen(env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
});
