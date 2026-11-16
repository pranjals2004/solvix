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
  ML_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  LLM_MODE: z.enum(['mock', 'live']).default('mock'),
  LLM_PROVIDER: z.enum(['gemini', 'anthropic', 'openai']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('solvix-uploads'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
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
  mlServiceUrl: string;
  llmMode?: 'mock' | 'live';
  llmProvider?: 'gemini' | 'anthropic' | 'openai';
  geminiApiKey?: string;
  geminiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  s3Endpoint: string;
  s3PublicEndpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
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
    mlServiceUrl: parsed.data.ML_SERVICE_URL,
    llmMode: parsed.data.LLM_MODE,
    llmProvider: parsed.data.LLM_PROVIDER,
    geminiApiKey: parsed.data.GEMINI_API_KEY,
    geminiModel: parsed.data.GEMINI_MODEL,
    anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
    anthropicModel: parsed.data.ANTHROPIC_MODEL,
    openaiApiKey: parsed.data.OPENAI_API_KEY,
    openaiModel: parsed.data.OPENAI_MODEL,
    s3Endpoint: parsed.data.S3_ENDPOINT,
    s3PublicEndpoint: parsed.data.S3_PUBLIC_ENDPOINT ?? parsed.data.S3_ENDPOINT,
    s3Region: parsed.data.S3_REGION,
    s3Bucket: parsed.data.S3_BUCKET,
    s3AccessKey: parsed.data.S3_ACCESS_KEY,
    s3SecretKey: parsed.data.S3_SECRET_KEY,
  };
}
