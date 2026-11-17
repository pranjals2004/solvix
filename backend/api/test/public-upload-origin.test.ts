import { describe, expect, it } from 'vitest';
import { publicUploadEndpointForOrigin } from '../src/doubts/public-upload-origin';

describe('public upload endpoint selection', () => {
  it('uses the desktop browser loopback host for localhost Flutter web origins', () => {
    expect(publicUploadEndpointForOrigin('http://10.0.2.2:9000', 'http://localhost:57725', 'development'))
      .toBe('http://localhost:9000');
  });

  it('uses a loopback IP origin without changing the storage port', () => {
    expect(publicUploadEndpointForOrigin('http://10.0.2.2:9000', 'http://127.0.0.1:8080', 'development'))
      .toBe('http://127.0.0.1:9000');
  });

  it('keeps the configured emulator endpoint for requests without a browser origin', () => {
    expect(publicUploadEndpointForOrigin('http://10.0.2.2:9000', undefined, 'development'))
      .toBe('http://10.0.2.2:9000');
  });

  it('does not rewrite public endpoints in production or for unrelated origins', () => {
    expect(publicUploadEndpointForOrigin('https://uploads.solvix.example', 'http://localhost:57725', 'production'))
      .toBe('https://uploads.solvix.example');
    expect(publicUploadEndpointForOrigin('http://10.0.2.2:9000', 'https://example.com', 'development'))
      .toBe('http://10.0.2.2:9000');
  });
});
