import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
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

  // 2. Multer Upload Errors (LIMIT_FILE_SIZE -> 413, outros -> 400)
  if (err instanceof multer.MulterError || err?.name === 'MulterError') {
    const isSizeLimit = err.code === 'LIMIT_FILE_SIZE';
    res.status(isSizeLimit ? 413 : 400).json({
      error: {
        code: err.code || 'UPLOAD_ERROR',
        message: isSizeLimit
          ? 'O arquivo excede o limite máximo permitido de 5MB.'
          : (err.message || 'Erro durante o envio do arquivo.')
      }
    });
    return;
  }

  // 3. Custom AppError (Operational)
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

  // 4. PostgreSQL Known Errors
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

  if (
    err?.code === 'ECONNREFUSED' ||
    err?.code === '57P01' ||
    err?.code === 'ENOTFOUND' ||
    err?.message?.includes('PostgreSQL indisponível') ||
    err?.message?.includes('Connection terminated')
  ) {
    res.status(503).json({
      error: {
        code: 'DB_UNAVAILABLE',
        message: 'O serviço de banco de dados está temporariamente inacessível. Tente novamente em instantes.'
      }
    });
    return;
  }

  // 5. Fallback: Erro Inesperado (500) - NUNCA expõe stack trace
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocorreu um erro interno no servidor.'
    }
  });
};
