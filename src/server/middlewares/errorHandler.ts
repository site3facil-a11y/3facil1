import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { env } from '../config/env.js';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Os dados fornecidos contêm erros de validação.',
        details: err.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message
        }))
      }
    });
    return;
  }

  // 2. Custom AppError (Operational)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  // 3. PostgreSQL Known Errors
  if (err?.code === '23505') {
    // Unique violation
    res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Já existe um registro com os identificadores fornecidos (e-mail, slug ou chave única duplicada).'
      }
    });
    return;
  }

  if (err?.code === 'ECONNREFUSED' || err?.code === '57P01') {
    res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'O serviço de banco de dados está temporariamente inacessível. Tente novamente em instantes.'
      }
    });
    return;
  }

  // 4. Fallback: Erro Inesperado (500)
  console.error('[Unhandled Server Error]:', err);
  const isProd = env.NODE_ENV === 'production';

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProd ? 'Ocorreu um erro interno no servidor.' : (err.message || 'Erro inesperado.'),
      ...(isProd ? {} : { stack: err.stack })
    }
  });
};
