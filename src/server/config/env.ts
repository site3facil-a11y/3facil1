import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || Boolean(process.env.npm_lifecycle_event?.includes('test'));

export const appUrlSchema = z
  .string()
  .trim()
  .url({ message: 'APP_URL deve ser uma URL válida.' })
  .refine(
    (val) => {
      try {
        return new URL(val).protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'APP_URL deve utilizar o protocolo HTTPS (ex: https://3facil.com).' }
  )
  .transform((val) => val.replace(/\/+$/, ''));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default(isTestEnv ? 'test' : 'development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().optional().default(process.env.DATABASE_URL || ''),
  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET deve ter no mínimo 32 caracteres criptograficamente seguros.'
  }).default(
    isTestEnv ? 'test_jwt_secret_must_be_at_least_32_characters_long_for_security' : (process.env.JWT_SECRET as string)
  ),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  APP_URL: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    appUrlSchema.default('https://3facil.com')
  ),
  ENABLE_SELF_UPDATE: z.enum(['true', 'false']).default('false'),
  SEED_DEMO: z.enum(['true', 'false']).default('false')
});

let parsedEnv: z.infer<typeof envSchema>;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (err: any) {
  if (err instanceof z.ZodError) {
    console.error('❌ [Config] Falha na validação das variáveis de ambiente:');
    for (const issue of err.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    // Em ambiente de teste, podemos fornecer fallback seguro se não estiver definido
    if (isTestEnv) {
      parsedEnv = {
        NODE_ENV: 'test',
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL || '',
        JWT_SECRET: 'test_jwt_secret_must_be_at_least_32_characters_long_for_security',
        ALLOWED_ORIGINS: '*',
        APP_URL: 'https://3facil.com',
        ENABLE_SELF_UPDATE: 'false',
        SEED_DEMO: 'false'
      } as any;
    } else {
      process.exit(1);
    }
  } else {
    throw err;
  }
}

/**
 * Retorna a URL base confiável da aplicação a partir de process.env.APP_URL (validada como HTTPS),
 * ignorando cabeçalhos controlados pelo cliente como Origin e Host.
 */
export function getTrustedAppUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw) {
    return appUrlSchema.parse(raw);
  }
  return parsedEnv.APP_URL;
}

export const env = parsedEnv;
