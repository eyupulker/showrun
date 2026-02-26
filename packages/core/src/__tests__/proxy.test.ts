import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OxylabsProvider } from '../proxy/oxylabs.js';
import {
  resolveProxy,
  registerProxyProvider,
  getProxyProvider,
  listProxyProviders,
} from '../proxy/proxyService.js';
import type { ProxyConfig, ProxyCredentials, ProxyProvider, ResolvedProxy } from '../proxy/types.js';

describe('OxylabsProvider', () => {
  const provider = new OxylabsProvider();
  const creds: ProxyCredentials = { username: 'testuser', password: 'testpass' };

  it('generates correct random mode username', () => {
    const config: ProxyConfig = { enabled: true, mode: 'random' };
    const result = provider.resolve(config, creds);

    expect(result.server).toBe('http://pr.oxylabs.io:7777');
    expect(result.username).toBe('customer-testuser');
    expect(result.password).toBe('testpass');
  });

  it('generates correct session mode username with sessid and sesstime', () => {
    const config: ProxyConfig = { enabled: true, mode: 'session', sessionDurationMinutes: 15 };
    const result = provider.resolve(config, creds);

    expect(result.server).toBe('http://pr.oxylabs.io:7777');
    expect(result.username).toMatch(/^customer-testuser-sessid-[a-f0-9]+-sesstime-15$/);
    expect(result.password).toBe('testpass');
  });

  it('defaults to session mode when mode is not specified', () => {
    const config: ProxyConfig = { enabled: true };
    const result = provider.resolve(config, creds);

    expect(result.username).toContain('-sessid-');
    expect(result.username).toContain('-sesstime-10'); // default 10 min
  });

  it('includes country code when specified', () => {
    const config: ProxyConfig = { enabled: true, mode: 'random', country: 'US' };
    const result = provider.resolve(config, creds);

    expect(result.username).toBe('customer-testuser-cc-US');
  });

  it('uppercases country code', () => {
    const config: ProxyConfig = { enabled: true, mode: 'random', country: 'gb' };
    const result = provider.resolve(config, creds);

    expect(result.username).toBe('customer-testuser-cc-GB');
  });

  it('includes country before session params in session mode', () => {
    const config: ProxyConfig = { enabled: true, mode: 'session', country: 'DE' };
    const result = provider.resolve(config, creds);

    expect(result.username).toMatch(/^customer-testuser-cc-DE-sessid-[a-f0-9]+-sesstime-10$/);
  });

  it('reports required credential keys', () => {
    expect(provider.requiredCredentialKeys()).toEqual(['USERNAME', 'PASSWORD']);
  });
});

describe('resolveProxy', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean proxy env vars before each test
    delete process.env.SHOWRUN_PROXY_USERNAME;
    delete process.env.SHOWRUN_PROXY_PASSWORD;
    delete process.env.SHOWRUN_PROXY_PROVIDER;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it('returns null for undefined config', () => {
    expect(resolveProxy(undefined)).toBeNull();
  });

  it('returns null for disabled config', () => {
    expect(resolveProxy({ enabled: false })).toBeNull();
  });

  it('returns null and warns when env vars are missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveProxy({ enabled: true });
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('credentials not configured'));
    warnSpy.mockRestore();
  });

  it('resolves proxy when env vars are set', () => {
    process.env.SHOWRUN_PROXY_USERNAME = 'myuser';
    process.env.SHOWRUN_PROXY_PASSWORD = 'mypass';

    const result = resolveProxy({ enabled: true, mode: 'random' });
    expect(result).not.toBeNull();
    expect(result!.server).toBe('http://pr.oxylabs.io:7777');
    expect(result!.username).toBe('customer-myuser');
    expect(result!.password).toBe('mypass');
  });

  it('reads provider from env var', () => {
    process.env.SHOWRUN_PROXY_USERNAME = 'user';
    process.env.SHOWRUN_PROXY_PASSWORD = 'pass';
    process.env.SHOWRUN_PROXY_PROVIDER = 'oxylabs';

    const result = resolveProxy({ enabled: true, mode: 'random' });
    expect(result).not.toBeNull();
  });

  it('throws for unknown provider', () => {
    process.env.SHOWRUN_PROXY_USERNAME = 'user';
    process.env.SHOWRUN_PROXY_PASSWORD = 'pass';

    expect(() => resolveProxy({ enabled: true, provider: 'nonexistent' })).toThrow(
      'Unknown proxy provider "nonexistent"',
    );
  });
});

describe('provider registry', () => {
  it('lists default providers', () => {
    const names = listProxyProviders();
    expect(names).toContain('oxylabs');
  });

  it('gets a provider by name', () => {
    const provider = getProxyProvider('oxylabs');
    expect(provider).toBeDefined();
    expect(provider!.name).toBe('oxylabs');
  });

  it('registers a custom provider', () => {
    const custom: ProxyProvider = {
      name: 'custom-test',
      resolve(_config: ProxyConfig, creds: ProxyCredentials): ResolvedProxy {
        return { server: 'http://custom:1234', username: creds.username, password: creds.password };
      },
      requiredCredentialKeys() {
        return ['USERNAME', 'PASSWORD'];
      },
    };

    registerProxyProvider(custom);
    expect(getProxyProvider('custom-test')).toBe(custom);
    expect(listProxyProviders()).toContain('custom-test');
  });
});
