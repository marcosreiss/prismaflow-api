import 'reflect-metadata';
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

// Na VPS (process.env.VERCEL não existe): inicia o servidor normalmente.
// Na Vercel (process.env.VERCEL === '1'): pula o listen e usa apenas o export.
if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  });
}

export default app;