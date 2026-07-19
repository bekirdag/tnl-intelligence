import type { IncomingMessage } from 'node:http';
import type { CredentialActor } from './credentials.js';

export interface SessionAuthenticator {
  authenticate(request: IncomingMessage): Promise<CredentialActor>;
}

export class HeaderSessionAuthenticator implements SessionAuthenticator {
  async authenticate(request: IncomingMessage): Promise<CredentialActor> {
    const ownerId = header(request, 'x-tnl-user');
    const tenantId = header(request, 'x-tnl-tenant');
    if (!ownerId || !tenantId) throw new SessionError('authentication_required', 401);
    const recent = Number(header(request, 'x-tnl-recent-auth'));
    return {
      ownerId,
      tenantId,
      recentAuthenticationAt: Number.isFinite(recent) ? recent : 0,
    };
  }
}

export class SessionError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'SessionError';
  }
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value?.trim();
}
