import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default('postgres://postgres:postgres@localhost:5432/documind'),
  STORAGE_DIR: z.string().default('./storage/uploads'),
  TEMP_DIR: z.string().default('./storage/temporary'),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MAX_FILES_PER_REQUEST: z.coerce.number().int().min(1).max(20).default(5),
  EMBEDDING_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
  MOCK_EMBEDDING_DIM: z.coerce.number().int().min(8).max(2048).default(128),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_EMBEDDING_MODEL: z.string().default('text-embedding-004')
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  const env = parsed.data;
  if (env.EMBEDDING_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
    throw new Error('Invalid environment: GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini');
  }
  return env;
}

export type AppEnv = z.infer<typeof envSchema>;
export const env: AppEnv = loadEnv();
