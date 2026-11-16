import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('solvix-api'),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/).default('15m'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LLM_MODE: z.enum(['mock', 'live']).default('mock'),
  LLM_PROVIDER: z.enum(['gemini', 'anthropic', 'openai']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtIssuer: string;
  jwtAccessTtl: string;
  bcryptRounds: number;
  corsOrigins: string[];
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    redisUrl: parsed.data.REDIS_URL,
    jwtSecret: parsed.data.JWT_SECRET,
    jwtIssuer: parsed.data.JWT_ISSUER,
    jwtAccessTtl: parsed.data.JWT_ACCESS_TTL,
    bcryptRounds: parsed.data.BCRYPT_ROUNDS,
    corsOrigins: parsed.data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
