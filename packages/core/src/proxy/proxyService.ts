/**
 * Proxy service: provider registry and resolution.
 *
 * Reads credentials from environment variables:
 *   SHOWRUN_PROXY_USERNAME, SHOWRUN_PROXY_PASSWORD
 * Provider from config or SHOWRUN_PROXY_PROVIDER env var (default: 'oxylabs').
 *
 * Graceful fallback: if env vars are missing, returns null (no proxy) instead of throwing.
 */

import type { ProxyConfig, ProxyCredentials, ProxyProvider, ResolvedProxy } from './types.js';
import { OxylabsProvider } from './oxylabs.js';

// ── Provider registry ──────────────────────────────────────────────────

const providers = new Map<string, ProxyProvider>();

// Register OxyLabs by default
const defaultProvider = new OxylabsProvider();
providers.set(defaultProvider.name, defaultProvider);

/**
 * Register a custom proxy provider.
 */
export function registerProxyProvider(provider: ProxyProvider): void {
  providers.set(provider.name, provider);
}

/**
 * Get a registered proxy provider by name.
 */
export function getProxyProvider(name: string): ProxyProvider | undefined {
  return providers.get(name);
}

/**
 * List all registered proxy provider names.
 */
export function listProxyProviders(): string[] {
  return [...providers.keys()];
}

// ── Credential helpers ─────────────────────────────────────────────────

function readCredentialsFromEnv(): ProxyCredentials | null {
  const username = process.env.SHOWRUN_PROXY_USERNAME;
  const password = process.env.SHOWRUN_PROXY_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

// ── Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a proxy configuration into concrete connection details.
 *
 * Returns `null` when:
 * - config is undefined or disabled
 * - required env vars are missing (graceful fallback, logs warning)
 *
 * Throws when:
 * - provider name is unknown
 */
export function resolveProxy(config: ProxyConfig | undefined): ResolvedProxy | null {
  if (!config || !config.enabled) return null;

  const providerName = config.provider ?? process.env.SHOWRUN_PROXY_PROVIDER ?? 'oxylabs';
  const provider = providers.get(providerName);
  if (!provider) {
    throw new Error(
      `Unknown proxy provider "${providerName}". Registered providers: ${listProxyProviders().join(', ')}`
    );
  }

  const credentials = readCredentialsFromEnv();
  if (!credentials) {
    console.warn(
      `[proxy] Proxy enabled but credentials not configured. ` +
      `Set SHOWRUN_PROXY_USERNAME and SHOWRUN_PROXY_PASSWORD environment variables. ` +
      `Running without proxy.`
    );
    return null;
  }

  return provider.resolve(config, credentials);
}
