import type { AppConfig } from '../config/env';

export function publicUploadEndpointForOrigin(
  configuredEndpoint: string,
  origin: string | undefined,
  nodeEnv: AppConfig['nodeEnv'],
): string {
  if (nodeEnv === 'production' || !origin) return configuredEndpoint;
  try {
    const browserOrigin = new URL(origin);
    if (
      browserOrigin.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(browserOrigin.hostname)
    ) {
      return configuredEndpoint;
    }

    const endpoint = new URL(configuredEndpoint);
    endpoint.hostname = browserOrigin.hostname;
    return endpoint.toString().replace(/\/$/, '');
  } catch {
    return configuredEndpoint;
  }
}
