import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { StoreProfile, ProposalLead } from '../src/types/store.js';

export interface SmtpConfig {
  provider?: 'smtp' | 'resend';
  apiKey?: string; // Chave da API Resend (ex: re_...)
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
}

const DATA_DIR = path.join(process.cwd(), 'database_storage');
const SMTP_CONFIG_FILE = path.join(DATA_DIR, 'smtp_config.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[EmailService] Erro ao criar diretório:', err);
  }
}

export function getSmtpConfig(): SmtpConfig {
  ensureDataDir();
  let fileConfig: Partial<SmtpConfig> = {};
  try {
    if (fs.existsSync(SMTP_CONFIG_FILE)) {
      const raw = fs.readFileSync(SMTP_CONFIG_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        fileConfig = JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn('[EmailService] Erro ao ler smtp_config.json:', err);
  }

  const apiKey = process.env.RESEND_API_KEY || fileConfig.apiKey || '';
  const provider: 'smtp' | 'resend' = (process.env.EMAIL_PROVIDER as any) || fileConfig.provider || (apiKey ? 'resend' : 'smtp');
  const host = process.env.SMTP_HOST || fileConfig.host || '';
  const port = Number(process.env.SMTP_PORT || fileConfig.port) || 587;
  const user = process.env.SMTP_USER || fileConfig.user || '';
  const pass = process.env.SMTP_PASS || fileConfig.pass || '';
  const secure = process.env.SMTP_SECURE === 'true' || fileConfig.secure === true || port === 465;
  const from = process.env.SMTP_FROM || fileConfig.from || `"3Fácil Plataforma" <${user || 'contato@3facil.com'}>`;
  const replyTo = process.env.SMTP_REPLY_TO || fileConfig.replyTo || '';

  return { provider, apiKey, host, port, secure, user, pass, from, replyTo };
}

export function saveSmtpConfig(config: Partial<SmtpConfig>): boolean {
  ensureDataDir();
  try {
    const current = getSmtpConfig();
    const updated: SmtpConfig = {
      provider: config.provider ?? current.provider ?? (config.apiKey ? 'resend' : 'smtp'),
      apiKey: config.apiKey !== undefined ? config.apiKey.trim() : current.apiKey,
      host: (config.host ?? current.host).trim(),
      port: Number(config.port) || current.port || 587,
      secure: config.secure !== undefined ? Boolean(config.secure) : current.secure,
      user: (config.user ?? current.user).trim(),
      pass: config.pass !== undefined ? config.pass.replace(/\s+/g, '') : current.pass.replace(/\s+/g, ''),
      from: (config.from ?? current.from).trim(),
      replyTo: (config.replyTo ?? current.replyTo ?? '').trim(),
    };

    // Atualizar process.env na sessão atual
    if (updated.provider) process.env.EMAIL_PROVIDER = updated.provider;
    if (updated.apiKey) process.env.RESEND_API_KEY = updated.apiKey;
    process.env.SMTP_HOST = updated.host;
    process.env.SMTP_PORT = String(updated.port);
    process.env.SMTP_SECURE = String(updated.secure);
    process.env.SMTP_USER = updated.user;
    process.env.SMTP_PASS = updated.pass;
    process.env.SMTP_FROM = updated.from;
    process.env.SMTP_REPLY_TO = updated.replyTo || '';

    // Salvar em database_storage/smtp_config.json
    fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');

    // Tentar atualizar ou criar no arquivo .env
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
      
      const updateEnvKey = (key: string, value: string) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      };

      if (updated.apiKey) updateEnvKey('RESEND_API_KEY', updated.apiKey);
      if (updated.provider) updateEnvKey('EMAIL_PROVIDER', updated.provider);
      updateEnvKey('SMTP_HOST', updated.host);
      updateEnvKey('SMTP_PORT', String(updated.port));
      updateEnvKey('SMTP_SECURE', String(updated.secure));
      updateEnvKey('SMTP_USER', updated.user);
      updateEnvKey('SMTP_PASS', updated.pass);
      updateEnvKey('SMTP_FROM', updated.from);
      updateEnvKey('SMTP_REPLY_TO', updated.replyTo || '');

      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
    } catch (envErr) {
      console.warn('[EmailService] Não foi possível salvar diretamente no .env:', envErr);
    }

    return true;
  } catch (err) {
    console.error('[EmailService] Erro ao salvar configurações de e-mail:', err);
    return false;
  }
}

export function isSmtpConfigured(): boolean {
  const config = getSmtpConfig();
  // Se estiver usando Resend API com chave
  if (config.provider === 'resend' && config.apiKey && config.apiKey.length > 5) {
    return true;
  }
  // Se for Postfix local na porta 25 (não exige usuário/senha)
  const isLocalPostfix = (config.host === 'localhost' || config.host === '127.0.0.1' || config.host === 'host.docker.internal') && Number(config.port) === 25;
  if (isLocalPostfix) return true;
  // Se for SMTP externo tradicional com autenticação
  return Boolean(config.host && config.user && config.pass);
}

// Criação do Transporter Nodemailer (para modo SMTP)
export function createTransporter() {
  const config = getSmtpConfig();
  if (!config.host) return null;

  const transportOptions: any = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    tls: {
      rejectUnauthorized: false, // Evita falhas com certificados autoassinados em VPS
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  };

  if (config.user && config.pass) {
    transportOptions.auth = {
      user: config.user,
      pass: config.pass ? config.pass.replace(/\s+/g, '') : '',
    };
  }

  return nodemailer.createTransport(transportOptions);
}

/**
 * Envia e-mail via API REST HTTPS do Resend (Porta 443 — 100% imune a bloqueios de portas SMTP na Oracle/AWS)
 */
async function sendViaResend(
  apiKey: string,
  options: { from: string; to: string; subject: string; html: string; text?: string; replyTo?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo || undefined,
      }),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      let errMsg = data?.message || data?.error || `HTTP ${res.status}`;
      if (typeof errMsg === 'string') {
        if (errMsg.includes('only send testing emails to your own email address') || errMsg.includes('testing emails')) {
          errMsg = `Restrição do Resend Sandbox: O remetente de testes (onboarding@resend.dev) só entrega para o e-mail cadastrado na conta Resend (site3facil@gmail.com). Para entregar para ${options.to}, adicione e valide o domínio 3facil.com em resend.com/domains.`;
        } else if (errMsg.includes('not verified') || errMsg.includes('domain')) {
          errMsg = `Domínio não verificado no Resend: O domínio "${options.from}" ainda não foi verificado com registros DNS em resend.com/domains.`;
        }
      }
      return { success: false, error: errMsg };
    }

    return { success: true, messageId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Motor Unificado de Envio com Failover Automático:
 * 1. Tenta o provedor principal (Resend API ou SMTP)
 * 2. Se o principal falhar e houver fallback configurado, tenta o secundário
 */
async function sendEmailMessage(options: {
  to: string;
  subject: string;
  text?: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; message: string; messageId?: string; simulated?: boolean }> {
  const config = getSmtpConfig();

  if (!isSmtpConfigured()) {
    console.log(`[EmailService - SIMULADO] Destino: ${options.to} | Assunto: ${options.subject}`);
    return {
      success: true,
      simulated: true,
      message: `[Simulação] Mensagem preparada para ${options.to}. Configure o e-mail no Painel Master para envio real.`
    };
  }

  // 1. Tentar via Resend API (se configurado como prioritário ou único)
  if (config.provider === 'resend' || (config.apiKey && !config.host)) {
    const resendResult = await sendViaResend(config.apiKey || '', {
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || config.replyTo,
    });

    if (resendResult.success) {
      return {
        success: true,
        message: `E-mail enviado com sucesso via Resend API para ${options.to}`,
        messageId: resendResult.messageId
      };
    }

    // Se falhou no Resend e não tem SMTP configurado como fallback, retorna o erro
    if (!config.host) {
      return {
        success: false,
        message: `Falha no envio via Resend API: ${resendResult.error}`
      };
    }

    console.warn('[EmailService] Resend API falhou, tentando fallback via SMTP:', resendResult.error);
  }

  // 2. Tentar via Nodemailer SMTP (ou fallback do Resend)
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Cliente SMTP não pôde ser instanciado.' };
  }

  try {
    const info = await transporter.sendMail({
      from: config.from,
      replyTo: options.replyTo || config.replyTo || undefined,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return {
      success: true,
      message: `E-mail enviado com sucesso via SMTP para ${options.to}`,
      messageId: info.messageId
    };
  } catch (smtpErr: any) {
    console.error('[EmailService] Erro no envio via SMTP:', smtpErr);

    // Se falhou via SMTP mas tem chave do Resend configurada, tenta Resend como fallback!
    if (config.apiKey && config.provider !== 'resend') {
      console.log('[EmailService] Tentando envio de emergência via Resend API...');
      const fallbackResult = await sendViaResend(config.apiKey, {
        from: config.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo || config.replyTo,
      });

      if (fallbackResult.success) {
        return {
          success: true,
          message: `E-mail enviado com sucesso via Resend API (Fallback) para ${options.to}`,
          messageId: fallbackResult.messageId
        };
      }
    }

    let errMsg = smtpErr.message || 'Erro de conexão SMTP';
    if (errMsg.includes('ETIMEDOUT') || errMsg.includes('Connection timed out')) {
      errMsg = 'Timeout ao conectar no servidor SMTP. Sua VPS pode estar bloqueando portas SMTP de saída (25/465/587). Utilize a API do Resend via HTTPS.';
    } else if (errMsg.includes('535') || errMsg.includes('BadCredentials') || errMsg.includes('Username and Password not accepted')) {
      errMsg = 'Credenciais recusadas pelo provedor de e-mail. Para Gmail, utilize uma Senha de App de 16 caracteres.';
    }

    return { success: false, message: `Erro ao enviar e-mail: ${errMsg}` };
  }
}

// Testar Conexão / Status
export async function testSmtpConnection(): Promise<{ success: boolean; message: string; configDetails?: any }> {
  const config = getSmtpConfig();
  
  if (!isSmtpConfigured()) {
    return {
      success: false,
      message: 'Nenhum serviço de e-mail configurado. Configure a Chave da API Resend ou os dados de SMTP no Painel Master.',
      configDetails: {
        provider: config.provider,
        host: config.host || '(não definido)',
        hasApiKey: Boolean(config.apiKey),
      }
    };
  }

  // Se estiver configurado com Resend API
  if (config.provider === 'resend' || (config.apiKey && !config.host)) {
    try {
      const res = await fetch('https://api.resend.com/api-keys', {
        headers: { 'Authorization': `Bearer ${config.apiKey?.trim()}` }
      });
      if (res.ok) {
        return {
          success: true,
          message: `Conexão com Resend API (HTTPS) autenticada com sucesso! Pronto para envios em produção sem bloqueio de portas.`,
          configDetails: {
            provider: 'resend',
            from: config.from
          }
        };
      }
      const data: any = await res.json().catch(() => ({}));
      return {
        success: false,
        message: `Chave da API Resend inválida ou expirada: ${data?.message || data?.error || res.statusText}`,
        configDetails: { provider: 'resend' }
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao comunicar com a API do Resend: ${err.message}`,
        configDetails: { provider: 'resend' }
      };
    }
  }

  // Modo SMTP
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Falha ao instanciar o cliente SMTP.' };
  }

  try {
    await transporter.verify();
    return {
      success: true,
      message: `Conexão SMTP com ${config.host}:${config.port} autenticada com sucesso!`,
      configDetails: {
        provider: 'smtp',
        host: config.host,
        port: config.port,
        user: config.user,
        from: config.from,
      }
    };
  } catch (error: any) {
    console.error('[EmailService] Erro ao verificar SMTP:', error);
    let msg = error.message;
    if (msg.includes('ETIMEDOUT')) {
      msg = `Timeout na conexão com ${config.host}:${config.port}. O provedor da sua VPS bloqueia essa porta. Use a opção Resend API (HTTPS).`;
    }
    return {
      success: false,
      message: `Erro na autenticação SMTP: ${msg}`,
      configDetails: {
        provider: 'smtp',
        host: config.host,
        port: config.port,
        user: config.user,
      }
    };
  }
}

// Envio de E-mail de Boas-Vindas e Confirmação de Cadastro
export async function sendWelcomeEmail(store: StoreProfile, appUrl?: string): Promise<{ success: boolean; message: string; simulated?: boolean }> {
  const recipientEmail = store.ownerEmail || store.email;
  const recipientName = store.ownerName || store.name;
  const siteUrl = appUrl || process.env.APP_URL || 'https://3facil.com';
  const storeUrl = `${siteUrl}/?loja=${store.slug || store.id}`;
  const adminUrl = `${siteUrl}/?admin=true&store=${store.id}`;

  const storeTypeLabels: Record<string, string> = {
    veiculo: 'Loja de Veículos & Autos',
    imovel: 'Imobiliária & Corretores',
    produto: 'Loja de Produtos Físicos',
    servico: 'Prestador de Serviços',
  };

  const tipoLabel = storeTypeLabels[store.type] || 'Loja / Catálogo';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmação de Cadastro - 3Fácil</title>
      <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
        .logo span { color: #93c5fd; }
        .content { padding: 32px 24px; }
        .greeting { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; }
        .card { background-color: #0f172a; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #334155; }
        .card-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; }
        .card-row:last-child { border-bottom: none; }
        .card-label { color: #94a3b8; font-size: 14px; }
        .card-value { color: #f8fafc; font-size: 14px; font-weight: 600; }
        .credentials-box { background: rgba(37, 99, 235, 0.1); border: 1px solid #3b82f6; border-radius: 12px; padding: 18px; margin: 24px 0; }
        .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; text-align: center; margin: 10px 0; }
        .footer { background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">3<span>fácil</span>.com</div>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Plataforma de Vitrines e Catálogos Digitais</p>
        </div>
        <div class="content">
          <h2 class="greeting">Olá, ${recipientName}! 🎉</h2>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Sua vitrine digital na <strong>3Fácil</strong> foi criada com sucesso e já está pronta para receber visitas e novos clientes!
          </p>

          <div class="card">
            <div class="card-row">
              <span class="card-label">Nome da Vitrine</span>
              <span class="card-value">${store.name}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Segmento</span>
              <span class="card-value">${tipoLabel}</span>
            </div>
            <div class="card-row">
              <span class="card-label">WhatsApp de Contato</span>
              <span class="card-value">${store.whatsapp || 'Não informado'}</span>
            </div>
          </div>

          <div class="credentials-box">
            <h3 style="margin: 0 0 12px 0; color: #93c5fd; font-size: 16px;">🔑 Seus Dados de Acesso:</h3>
            <p style="margin: 6px 0; font-size: 14px;"><strong>E-mail de Login:</strong> <span style="font-family: monospace; color: #38bdf8;">${recipientEmail}</span></p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Senha:</strong> <span style="font-family: monospace; color: #38bdf8;">${store.password || 'Definida no formulário de cadastro'}</span></p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Link da sua Vitrine:</strong> <a href="${storeUrl}" style="color: #60a5fa;" target="_blank">${storeUrl}</a></p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${adminUrl}" class="button">Acessar Meu Painel de Lojista</a>
          </div>
        </div>
        <div class="footer">
          <p style="margin: 0;">Você recebeu esta mensagem porque sua loja foi cadastrada na plataforma 3facil.com.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmailMessage({
    to: recipientEmail,
    subject: `🎉 Cadastro Confirmado: Bem-vindo à 3Fácil - ${store.name}`,
    text: `Olá ${recipientName}!\n\nSua loja "${store.name}" foi criada com sucesso no 3facil.com.\n\nSEUS DADOS DE ACESSO:\n- E-mail: ${recipientEmail}\n- Senha: ${store.password || 'Definida no cadastro'}\n- Link da Vitrine: ${storeUrl}\n- Painel do Lojista: ${adminUrl}\n\nAcesse seu painel agora mesmo para cadastrar seus produtos ou serviços!`,
    html: htmlContent,
  });
}

// Envio de E-mail de Teste
export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string; simulated?: boolean }> {
  return sendEmailMessage({
    to: toEmail,
    subject: `✅ Teste de Envio de E-mail - 3facil.com`,
    text: `Este é um e-mail de teste disparado pelo painel da plataforma 3facil.com.\n\nSe você está lendo isso, o serviço de envio de e-mails da sua plataforma está 100% operacional!`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; max-width: 520px; margin: 0 auto; border: 1px solid #334155;">
        <h2 style="color: #38bdf8; margin-top: 0;">✅ Teste de E-mail Concluído com Sucesso!</h2>
        <p style="font-size: 14px; line-height: 1.6;">O serviço de e-mails transacionais da plataforma <strong>3facil.com</strong> está configurado e funcionando perfeitamente.</p>
        <div style="background: rgba(255,255,255,0.06); padding: 14px; border-radius: 8px; margin: 18px 0; font-size: 13px;">
          <p style="margin: 0 0 6px 0;"><strong>Destinatário:</strong> ${toEmail}</p>
          <p style="margin: 0;"><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Seus clientes e lojistas receberão propostas e notificações normalmente.</p>
      </div>
    `
  });
}

// Notificação por e-mail ao lojista quando um novo lead/proposta chega pela vitrine pública
export async function sendNewLeadEmail(
  store: StoreProfile,
  lead: ProposalLead,
  appUrl?: string
): Promise<{ success: boolean; message: string; simulated?: boolean }> {
  const recipientEmail = store.ownerEmail || store.email;

  if (!recipientEmail) {
    return { success: false, message: 'A loja não tem e-mail cadastrado para receber notificações.' };
  }

  const siteUrl = appUrl || process.env.APP_URL || 'https://3facil.com';
  const adminUrl = `${siteUrl}/?admin=true&store=${store.id}`;

  const itemTypeLabels: Record<string, string> = {
    veiculo: 'Veículo',
    imovel: 'Imóvel',
    produto: 'Produto',
    servico: 'Serviço',
  };
  const tipoLabel = itemTypeLabels[lead.itemType] || 'Item';

  // Link direto para responder o cliente no WhatsApp com um clique
  const cleanClientPhone = lead.clientPhone ? lead.clientPhone.replace(/\D/g, '') : '';
  const waReplyUrl = cleanClientPhone 
    ? `https://wa.me/55${cleanClientPhone}?text=${encodeURIComponent(`Olá ${lead.clientName}, vi seu interesse no anúncio "${lead.itemTitle}" na ${store.name}. Como posso ajudar?`)}`
    : '';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; padding: 24px; border-radius: 16px; max-width: 560px; margin: 0 auto; border: 1px solid #334155;">
      <h2 style="color: #34d399; margin-top: 0; font-size: 22px;">💬 Novo Lead Recebido!</h2>
      <p style="font-size: 14px; line-height: 1.5;">Um novo cliente demonstrou interesse em um anúncio da sua vitrine na <strong>${store.name}</strong>:</p>

      <div style="background-color: #0f172a; border-radius: 12px; padding: 18px 20px; margin: 20px 0; border: 1px solid #334155;">
        <p style="margin: 6px 0;"><strong style="color: #94a3b8;">${tipoLabel}:</strong> <span style="color: #f8fafc; font-weight: 600;">${lead.itemTitle}</span></p>
        <p style="margin: 6px 0;"><strong style="color: #94a3b8;">Cliente:</strong> <span style="color: #f8fafc;">${lead.clientName}</span></p>
        <p style="margin: 6px 0;"><strong style="color: #94a3b8;">WhatsApp / Tel:</strong> <a href="tel:${lead.clientPhone}" style="color: #60a5fa; text-decoration: none;">${lead.clientPhone || 'Não informado'}</a></p>
        <p style="margin: 6px 0;"><strong style="color: #94a3b8;">E-mail:</strong> ${lead.clientEmail || 'Não informado'}</p>
        ${lead.proposalValue ? `<p style="margin: 6px 0;"><strong style="color: #94a3b8;">Valor Proposta:</strong> <span style="color: #34d399; font-weight: bold;">R$ ${Number(lead.proposalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>` : ''}
        ${lead.tradeDetails ? `<p style="margin: 6px 0;"><strong style="color: #94a3b8;">Detalhes:</strong> <span style="color: #cbd5e1;">${lead.tradeDetails}</span></p>` : ''}
        ${lead.clientMessage ? `<p style="margin: 6px 0;"><strong style="color: #94a3b8;">Mensagem:</strong> <span style="color: #e2e8f0;">${lead.clientMessage}</span></p>` : ''}
      </div>

      <div style="margin: 24px 0; text-align: center;">
        ${waReplyUrl ? `
          <a href="${waReplyUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; margin-right: 10px; margin-bottom: 8px;">
            📲 Chamar no WhatsApp
          </a>
        ` : ''}
        <a href="${adminUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; margin-bottom: 8px;">
          Abrir no Painel
        </a>
      </div>

      <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">Dica de Ouro: Leads atendidos nos primeiros 5 minutos convertem até 80% mais!</p>
    </div>
  `;

  return sendEmailMessage({
    to: recipientEmail,
    replyTo: lead.clientEmail || undefined,
    subject: `💬 Novo lead na sua loja "${store.name}": ${lead.itemTitle}`,
    text: `Novo lead recebido!\n\n${tipoLabel}: ${lead.itemTitle}\nCliente: ${lead.clientName}\nTelefone: ${lead.clientPhone || 'Não informado'}\nE-mail: ${lead.clientEmail || 'Não informado'}\n${lead.clientMessage ? `Mensagem: ${lead.clientMessage}\n` : ''}\nAcesse seu painel: ${adminUrl}`,
    html: htmlContent,
  });
}

// Envio de E-mail de Redefinição de Senha
export async function sendPasswordResetEmail(
  toEmail: string,
  resetLink: string,
  targetName?: string,
  role: 'store' | 'superadmin' = 'store'
): Promise<{ success: boolean; message: string; simulated?: boolean }> {
  const isStore = role === 'store';
  const subject = isStore
    ? `🔑 Redefinição de senha — ${targetName || 'Sua Loja'} | 3fácil.com`
    : '🔑 Redefinição de senha — Painel Master 3fácil.com';

  const title = isStore
    ? `Redefinir Senha da Loja "${targetName || 'sua loja'}"`
    : 'Redefinir Senha do Painel Master';

  const bodyDescription = isStore
    ? `Recebemos um pedido para criar uma nova senha de acesso à sua loja <strong>${targetName || ''}</strong> na plataforma 3fácil.com.`
    : `Recebemos um pedido para redefinir a senha do <strong>Painel Master</strong> da plataforma 3fácil.com.`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 28px; background: #0f172a; color: #f8fafc; border-radius: 16px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 36px;">🔑</span>
        <h2 style="color: #ffffff; margin: 10px 0 6px 0; font-size: 22px;">${title}</h2>
        <p style="color: #94a3b8; font-size: 13px; margin: 0;">Plataforma 3fácil.com</p>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 18px; border-radius: 12px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1);">
        <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6; margin: 0;">
          ${bodyDescription}
        </p>
      </div>
      <div style="text-align: center; margin: 26px 0;">
        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
          Criar Nova Senha
        </a>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5; text-align: center; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;">
        Este link é seguro e expira em 30 minutos.<br />
        Se você não solicitou essa redefinição, fique tranquilo: sua conta permanece segura e sua senha atual não foi alterada.
      </p>
    </div>
  `;

  return sendEmailMessage({
    to: toEmail,
    subject,
    text: `${title}\n\n${bodyDescription.replace(/<[^>]+>/g, '')}\n\nClique no link abaixo para criar sua nova senha (válido por 30 minutos):\n${resetLink}\n\nSe não foi você que solicitou, ignore este e-mail — sua senha atual continua válida e segura.`,
    html: htmlContent,
  });
}
