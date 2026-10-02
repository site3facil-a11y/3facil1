import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().optional().default(process.env.DATABASE_URL || ''),
  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET deve ter no mínimo 32 caracteres criptograficamente seguros.'
  }),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  APP_URL: z.string().url().optional().default('http://localhost:3000'),
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
    if (process.env.NODE_ENV === 'test') {
      parsedEnv = {
        NODE_ENV: 'test',
        PORT: 3000,
        DATABASE_URL: '',
        JWT_SECRET: 'test_jwt_secret_must_be_at_least_32_characters_long_for_security',
        ALLOWED_ORIGINS: '*',
        APP_URL: 'http://localhost:3000',
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

export const env = parsedEnv;
