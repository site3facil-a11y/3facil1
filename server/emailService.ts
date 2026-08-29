import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { StoreProfile, ProposalLead } from '../src/types/store.js';

export interface SmtpConfig {
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
  // 1. Tentar ler do arquivo database_storage/smtp_config.json salvo pelo painel
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

  const host = process.env.SMTP_HOST || fileConfig.host || '';
  const port = Number(process.env.SMTP_PORT || fileConfig.port) || 587;
  const user = process.env.SMTP_USER || fileConfig.user || '';
  const pass = process.env.SMTP_PASS || fileConfig.pass || '';
  const secure = process.env.SMTP_SECURE === 'true' || fileConfig.secure === true || port === 465;
  const from = process.env.SMTP_FROM || fileConfig.from || `"3Fácil Plataforma" <${user || 'contato@3facil.com'}>`;
  const replyTo = process.env.SMTP_REPLY_TO || fileConfig.replyTo || '';

  return { host, port, secure, user, pass, from, replyTo };
}

export function saveSmtpConfig(config: Partial<SmtpConfig>): boolean {
  ensureDataDir();
  try {
    const current = getSmtpConfig();
    const updated: SmtpConfig = {
      host: (config.host ?? current.host).trim(),
      port: Number(config.port) || current.port || 587,
      secure: config.secure !== undefined ? Boolean(config.secure) : current.secure,
      user: (config.user ?? current.user).trim(),
      pass: config.pass !== undefined ? config.pass.trim() : current.pass,
      from: (config.from ?? current.from).trim(),
      replyTo: (config.replyTo ?? current.replyTo ?? '').trim(),
    };

    // Atualizar process.env na sessão atual
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
    console.error('[EmailService] Erro ao salvar configurações de SMTP:', err);
    return false;
  }
}

export function isSmtpConfigured(): boolean {
  const config = getSmtpConfig();
  return Boolean(config.host && config.user && config.pass);
}

// Criação do Transporter Nodemailer
export function createTransporter() {
  const config = getSmtpConfig();
  if (!isSmtpConfigured()) return null;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false, // Evita falhas com certificados autoassinados em VPS
    },
  });
}

// Testar Conexão SMTP
export async function testSmtpConnection(): Promise<{ success: boolean; message: string; configDetails?: any }> {
  const config = getSmtpConfig();
  
  if (!isSmtpConfigured()) {
    return {
      success: false,
      message: 'SMTP não configurado no .env. Configure SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS.',
      configDetails: {
        host: config.host || '(não definido)',
        port: config.port,
        user: config.user || '(não definido)',
        hasPassword: Boolean(config.pass),
      }
    };
  }

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
        host: config.host,
        port: config.port,
        user: config.user,
        from: config.from,
      }
    };
  } catch (error: any) {
    console.error('[EmailService] Erro ao verificar SMTP:', error);
    return {
      success: false,
      message: `Erro na autenticação SMTP: ${error.message}`,
      configDetails: {
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
        .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; text-align: center; margin: 10px 0; }
        .button-secondary { background-color: #334155; margin-left: 8px; }
        .footer { background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
        .badge { display: inline-block; background-color: #10b981; color: #ffffff; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
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
          <p style="color: #cbd5e1; line-height: 1.6; margin-top: 0;">
            Seu cadastro foi realizado com sucesso na plataforma <strong>3facil.com</strong>! Sua vitrine profissional já está configurada e pronta para receber produtos e clientes.
          </p>

          <div class="card">
            <div style="margin-bottom: 12px;">
              <span class="badge">Cadastro Confirmado</span>
            </div>
            <div class="card-row">
              <span class="card-label">Nome da Loja:</span>
              <span class="card-value">${store.name}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Segmento / Modelo:</span>
              <span class="card-value">${tipoLabel}</span>
            </div>
            <div class="card-row">
              <span class="card-label">WhatsApp de Vendas:</span>
              <span class="card-value">${store.whatsapp}</span>
            </div>
            <div class="card-row">
              <span class="card-label">Plano Selecionado:</span>
              <span class="card-value">${store.planName || store.plan || 'Profissional'} (R$ ${Number(store.monthlyFee || 30).toFixed(2)}/mês)</span>
            </div>
            <div class="card-row">
              <span class="card-label">Próximo Vencimento:</span>
              <span class="card-value">${store.nextDueDate || '30 dias'}</span>
            </div>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${adminUrl}" class="button">Acessar Meu Painel de Gestão</a>
            <br>
            <a href="${storeUrl}" style="color: #60a5fa; font-size: 13px; text-decoration: underline; display: inline-block; margin-top: 12px;">
              Visualizar Minha Vitrine Pública Online (${store.slug})
            </a>
          </div>

          <div style="background-color: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.3); border-radius: 10px; padding: 14px; font-size: 13px; color: #93c5fd; line-height: 1.5;">
            💡 <strong>Próximos passos:</strong> Cadastre suas primeiras fotos, produtos ou veículos e compartilhe o link direto com seus clientes no WhatsApp e redes sociais.
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0 0 6px 0;">© ${new Date().getFullYear()} 3facil.com - Todos os direitos reservados.</p>
          <p style="margin: 0;">Você recebeu este e-mail porque cadastrou sua loja em nossa plataforma.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!isSmtpConfigured()) {
    console.log(`[EmailService - SIMULADO] Confirmação de Cadastro para: ${recipientEmail} | Loja: ${store.name}`);
    return {
      success: true,
      simulated: true,
      message: `[Simulação] E-mail de confirmação preparado para ${recipientEmail}. Para envio real via internet, configure o SMTP no arquivo .env.`
    };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Transporter SMTP não disponível.' };
  }

  try {
    const config = getSmtpConfig();
    const info = await transporter.sendMail({
      from: config.from,
      replyTo: config.replyTo || undefined,
      to: recipientEmail,
      subject: `🎉 Cadastro Confirmado: Bem-vindo à 3Fácil - ${store.name}`,
      text: `Olá ${recipientName}! Sua loja "${store.name}" foi criada com sucesso no 3facil.com.\n\nAcesse seu painel em: ${adminUrl}\nVeja sua vitrine em: ${storeUrl}`,
      html: htmlContent,
    });

    console.log('[EmailService] E-mail de boas-vindas enviado com sucesso:', info.messageId);
    return { success: true, message: `E-mail de confirmação enviado para ${recipientEmail}!` };
  } catch (error: any) {
    console.error('[EmailService] Falha ao enviar e-mail de boas-vindas:', error);
    return { success: false, message: `Erro ao enviar e-mail: ${error.message}` };
  }
}

// Envio de E-mail de Teste
export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string; simulated?: boolean }> {
  if (!isSmtpConfigured()) {
    return {
      success: false,
      simulated: true,
      message: 'SMTP não configurado no .env. Adicione SMTP_HOST, SMTP_USER e SMTP_PASS para disparar e-mails reais.'
    };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Transporter SMTP não disponível.' };
  }

  try {
    const config = getSmtpConfig();
    await transporter.sendMail({
      from: config.from,
      replyTo: config.replyTo || undefined,
      to: toEmail,
      subject: `✅ Teste de Envio de E-mail - 3facil.com`,
      text: `Este é um e-mail de teste disparado pelo painel da plataforma 3facil.com.\n\nSe você está lendo isso, a configuração SMTP do seu servidor está 100% funcional!`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
          <h2 style="color: #38bdf8;">✅ Teste de E-mail Concluído com Sucesso!</h2>
          <p>O serviço de envio de e-mails transacionais da plataforma <strong>3facil.com</strong> está configurado e funcionando corretamente.</p>
          <p style="color: #94a3b8; font-size: 13px;">Disparado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      `
    });

    return { success: true, message: `E-mail de teste enviado com sucesso para ${toEmail}!` };
  } catch (error: any) {
    return { success: false, message: `Falha no envio do teste: ${error.message}` };
  }
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

  if (!isSmtpConfigured()) {
    return {
      success: false,
      simulated: true,
      message: 'SMTP não configurado no servidor — o lead foi salvo normalmente, mas nenhum e-mail de aviso foi disparado.'
    };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Transporter SMTP não disponível.' };
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

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; padding: 24px; border-radius: 16px; max-width: 560px; margin: 0 auto; border: 1px solid #334155;">
      <h2 style="color: #34d399; margin-top: 0;">💬 Novo Lead Recebido!</h2>
      <p>Alguém demonstrou interesse em um dos seus anúncios na <strong>${store.name}</strong>.</p>

      <div style="background-color: #0f172a; border-radius: 12px; padding: 16px 20px; margin: 20px 0; border: 1px solid #334155;">
        <p style="margin: 4px 0;"><strong style="color: #94a3b8;">${tipoLabel}:</strong> ${lead.itemTitle}</p>
        <p style="margin: 4px 0;"><strong style="color: #94a3b8;">Cliente:</strong> ${lead.clientName}</p>
        <p style="margin: 4px 0;"><strong style="color: #94a3b8;">Telefone:</strong> ${lead.clientPhone || 'Não informado'}</p>
        <p style="margin: 4px 0;"><strong style="color: #94a3b8;">E-mail:</strong> ${lead.clientEmail || 'Não informado'}</p>
        ${lead.clientMessage ? `<p style="margin: 4px 0;"><strong style="color: #94a3b8;">Mensagem:</strong> ${lead.clientMessage}</p>` : ''}
      </div>

      <p style="margin: 24px 0;">
        <a href="${adminUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700;">
          Ver no Painel
        </a>
      </p>

      <p style="color: #64748b; font-size: 12px;">Responda rápido — leads atendidos nos primeiros minutos convertem muito mais.</p>
    </div>
  `;

  try {
    const config = getSmtpConfig();
    await transporter.sendMail({
      from: config.from,
      replyTo: lead.clientEmail || config.replyTo || undefined,
      to: recipientEmail,
      subject: `💬 Novo lead na sua loja "${store.name}": ${lead.itemTitle}`,
      text: `Novo lead recebido!\n\n${tipoLabel}: ${lead.itemTitle}\nCliente: ${lead.clientName}\nTelefone: ${lead.clientPhone || 'Não informado'}\nE-mail: ${lead.clientEmail || 'Não informado'}\n${lead.clientMessage ? `Mensagem: ${lead.clientMessage}\n` : ''}\nAcesse seu painel: ${adminUrl}`,
      html: htmlContent,
    });

    return { success: true, message: `E-mail de notificação de lead enviado para ${recipientEmail}!` };
  } catch (error: any) {
    console.error('[EmailService] Falha ao enviar e-mail de novo lead:', error);
    return { success: false, message: `Erro ao enviar e-mail: ${error.message}` };
  }
}

// Envio de E-mail de Redefinição de Senha (Super Admin "Esqueci minha senha")
export async function sendPasswordResetEmail(
  toEmail: string,
  resetLink: string
): Promise<{ success: boolean; message: string; simulated?: boolean }> {
  if (!isSmtpConfigured()) {
    return {
      success: false,
      simulated: true,
      message: 'SMTP não configurado no servidor. Peça ao responsável técnico para configurar o envio de e-mails, ou redefina a senha diretamente no banco de dados.'
    };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Transporter SMTP não disponível.' };
  }

  try {
    const config = getSmtpConfig();
    await transporter.sendMail({
      from: config.from,
      replyTo: config.replyTo || undefined,
      to: toEmail,
      subject: '🔑 Redefinição de senha — Painel Master 3fácil.com',
      text: `Recebemos um pedido para redefinir a senha do Painel Master.\n\nSe foi você, clique no link abaixo (válido por 30 minutos):\n${resetLink}\n\nSe não foi você, ignore este e-mail — sua senha atual continua válida.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #a78bfa; margin-top: 0;">🔑 Redefinição de Senha</h2>
          <p>Recebemos um pedido para redefinir a senha do <strong>Painel Master</strong> da plataforma 3fácil.com.</p>
          <p style="margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700;">
              Criar Nova Senha
            </a>
          </p>
          <p style="color: #94a3b8; font-size: 13px;">Este link é válido por 30 minutos. Se você não pediu essa redefinição, pode ignorar este e-mail com segurança — sua senha atual continua funcionando normalmente.</p>
        </div>
      `
    });

    return { success: true, message: `E-mail de redefinição enviado para ${toEmail}!` };
  } catch (error: any) {
    return { success: false, message: `Falha no envio do e-mail de redefinição: ${error.message}` };
  }
}
