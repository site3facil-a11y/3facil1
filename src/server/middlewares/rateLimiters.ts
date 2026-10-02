import rateLimit from 'express-rate-limit';

const isTest = () => Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest() ? 10000 : 300,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições originadas deste IP. Aguarde alguns instantes antes de tentar novamente.'
    }
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest() ? 10000 : 10,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_AUTH_ATTEMPTS',
      message: 'Muitas tentativas de autenticação consecutivas. Por segurança, tente novamente em 15 minutos.'
    }
  }
});

export const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: isTest() ? 10000 : 10,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_PROPOSALS',
      message: 'Limite de propostas por hora atingido. Aguarde antes de enviar novas mensagens.'
    }
  }
});

export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTest() ? 10000 : 10,
  skip: isTest,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: false
  },
  message: {
    error: {
      code: 'TOO_MANY_EMAILS',
      message: 'Limite de envio de e-mails atingido temporariamente. Tente novamente mais tarde.'
    }
  }
});
