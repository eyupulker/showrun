/**
 * OxyLabs residential proxy provider.
 *
 * Endpoint: pr.oxylabs.io:7777
 * Username format:
 *   Random: customer-{USERNAME}[-cc-{COUNTRY}]
 *   Session: customer-{USERNAME}[-cc-{COUNTRY}]-sessid-{UUID}-sesstime-{MIN}
 */

import { randomUUID } from 'crypto';
import type { ProxyConfig, ProxyCredentials, ProxyProvider, ResolvedProxy } from './types.js';

const OXYLABS_ENDPOINT = 'http://pr.oxylabs.io:7777';
const DEFAULT_SESSION_DURATION_MINUTES = 10;

export class OxylabsProvider implements ProxyProvider {
  readonly name = 'oxylabs';

  resolve(config: ProxyConfig, credentials: ProxyCredentials): ResolvedProxy {
    const mode = config.mode ?? 'session';
    let username = `customer-${credentials.username}`;

    if (config.country) {
      username += `-cc-${config.country.toUpperCase()}`;
    }

    if (mode === 'session') {
      const sessionId = randomUUID().replace(/-/g, '');
      const duration = config.sessionDurationMinutes ?? DEFAULT_SESSION_DURATION_MINUTES;
      username += `-sessid-${sessionId}-sesstime-${duration}`;
    }

    return {
      server: OXYLABS_ENDPOINT,
      username,
      password: credentials.password,
    };
  }

  requiredCredentialKeys(): string[] {
    return ['USERNAME', 'PASSWORD'];
  }
}
