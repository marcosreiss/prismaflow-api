import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { router } from './routes';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();

// Middlewares globais
app.use(express.json());
app.use(cors());              // libera CORS
app.use(helmet());            // segurança HTTP
app.use(morgan('dev'));       // logs de requisições

// Rotas
app.use(router);

// Porta vinda do .env (ou 3000 por padrão)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
