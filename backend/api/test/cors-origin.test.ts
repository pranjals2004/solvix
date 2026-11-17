import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '../src/http/cors-origin';

describe('browser origin access', () => {
  const development = { nodeEnv: 'development' as const, corsOrigins: ['http://localhost:3000'] };
  const production = { nodeEnv: 'production' as const, corsOrigins: ['https://solvix.example'] };

  it('allows the changing localhost port used by Flutter web during development', () => {
    expect(isAllowedOrigin('http://localhost:57725', development)).toBe(true);
  });

  it('allows loopback IP origins during development', () => {
    expect(isAllowedOrigin('http://127.0.0.1:57725', development)).toBe(true);
  });

  it('still rejects unrelated origins during development', () => {
    expect(isAllowedOrigin('https://example.com', development)).toBe(false);
  });

  it('does not allow arbitrary localhost ports in production', () => {
    expect(isAllowedOrigin('http://localhost:57725', production)).toBe(false);
  });
});
