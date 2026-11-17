import type { AppConfig } from '../config/env';

export function isAllowedOrigin(
  origin: string | undefined,
  config: Pick<AppConfig, 'nodeEnv' | 'corsOrigins'>,
): boolean {
  if (!origin || config.corsOrigins.includes(origin)) return true;
  if (config.nodeEnv === 'production') return false;

  try {
    const parsedOrigin = new URL(origin);
    return (
      parsedOrigin.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsedOrigin.hostname)
    );
  } catch {
    return false;
  }
}
