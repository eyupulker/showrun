/**
 * Proxy configuration types for browser and HTTP request proxying.
 */

/**
 * Proxy mode determines how proxy sessions are managed:
 * - 'session': Sticky IP for the duration of the session (default)
 * - 'random': Rotating IP per request
 */
export type ProxyMode = 'session' | 'random';

/**
 * Proxy configuration stored in taskpack.json under `browser.proxy`.
 * Persisted by the agent's `set_proxy` tool.
 */
export interface ProxyConfig {
  /** Whether proxy is enabled */
  enabled: boolean;
  /** Proxy mode: sticky session or random rotation */
  mode?: ProxyMode;
  /** Provider name (default: 'oxylabs') */
  provider?: string;
  /** Two-letter ISO country code for geo-targeting */
  country?: string;
  /** Session duration in minutes (for session mode) */
  sessionDurationMinutes?: number;
}

/**
 * Resolved proxy credentials ready for Playwright / fetch.
 * Maps directly to Playwright's `proxy` launch option.
 */
export interface ResolvedProxy {
  server: string;
  username: string;
  password: string;
}

/**
 * Credentials supplied to a proxy provider (from env vars).
 */
export interface ProxyCredentials {
  username: string;
  password: string;
}

/**
 * Interface for pluggable proxy providers.
 * Implement this to add support for a new proxy service.
 */
export interface ProxyProvider {
  /** Provider name (e.g. 'oxylabs') */
  readonly name: string;

  /**
   * Resolve proxy config + credentials into a concrete proxy connection.
   */
  resolve(config: ProxyConfig, credentials: ProxyCredentials): ResolvedProxy;

  /**
   * List of env var suffixes this provider needs (for display/validation).
   * e.g. ['USERNAME', 'PASSWORD'] → expects SHOWRUN_PROXY_USERNAME, SHOWRUN_PROXY_PASSWORD
   */
  requiredCredentialKeys(): string[];
}
