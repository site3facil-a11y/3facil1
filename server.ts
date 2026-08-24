import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './src/routes/auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// Rota pública de autenticação
app.use('/api/auth', authRoutes);

// Pasta de armazenamento JSON
const DATA_DIR = path.join(__dirname, 'database_storage');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const readData = (filename: string) => {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
};

// Rota Bootstrap exigida pelo apiService.ts
app.get('/api/bootstrap', (req: Request, res: Response) => {
  res.json({
    stores: readData('stores.json'),
    items: readData('items.json'),
    leads: readData('leads.json'),
    settings: readData('settings.json') || {},
    connectedToPostgres: false
  });
});

// Fallback SPA do React
app.get('*', (req: Request, res: Response) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Servidor rodando.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
