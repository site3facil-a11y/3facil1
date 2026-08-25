import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Erro de configuração no servidor (JWT_SECRET ausente).' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token inválido ou expirado.' });
    return;
  }
};
