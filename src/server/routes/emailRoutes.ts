import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireSuperAdmin } from '../../middlewares/auth.js';
import { emailLimiter } from '../middlewares/rateLimiters.js';
import { validateBody } from '../validation/validate.js';
import { testEmailSchema, smtpConfigSchema } from '../validation/schemas.js';
import { 
  testSmtpConnection, 
  getSmtpConfig, 
  isSmtpConfigured, 
  saveSmtpConfig, 
  sendTestEmail, 
  sendWelcomeEmail 
} from '../../../server/emailService.js';
import { AppError } from '../errors/AppError.js';
import { env } from '../config/env.js';

const router = Router();

// Todas as rotas de e-mail são exclusivas do Super Admin e possuem rate limit próprio
router.use(authenticateToken, requireSuperAdmin, emailLimiter);

/**
 * GET /api/email/status
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isConfigured = isSmtpConfigured();
    const config = getSmtpConfig();

    if (!isConfigured) {
      return res.json({
        configured: false,
        provider: config.provider || 'smtp',
        hasApiKey: Boolean(config.apiKey),
        host: config.host || 'Não definido no .env',
        port: config.port,
        user: config.user || 'Não definido no .env',
        from: config.from,
        message: 'Serviço de e-mail não configurado. Configure a Chave da API Resend ou os dados de SMTP no Painel Master.'
      });
    }

    const testResult = await testSmtpConnection();
    res.json({
      configured: true,
      connected: testResult.success,
      provider: config.provider || (config.apiKey ? 'resend' : 'smtp'),
      hasApiKey: Boolean(config.apiKey),
      host: config.host,
      port: config.port,
      user: config.user,
      from: config.from,
      message: testResult.message
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/email/config
 */
router.post('/config', validateBody(smtpConfigSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, apiKey, host, port, user, pass, secure, from, replyTo } = req.body;
    const saved = saveSmtpConfig({ provider, apiKey, host, port, user, pass, secure, from, replyTo });
    if (!saved) {
      throw AppError.internal('Falha ao gravar arquivo de configuração de e-mail.');
    }

    const testResult = await testSmtpConnection();
    res.json({
      success: true,
      saved: true,
      connected: testResult.success,
      message: testResult.message,
      configDetails: testResult.configDetails
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/email/test
 */
router.post('/test', validateBody(testEmailSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to } = req.body;
    const result = await sendTestEmail(to);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/email/send-welcome
 */
router.post('/send-welcome', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { store } = req.body;
    if (!store || !store.id) {
      throw AppError.badRequest('Objeto de loja inválido.');
    }

    const originUrl = req.get('origin') || env.APP_URL;
    const result = await sendWelcomeEmail(store, originUrl);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
