import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface EndpointResolver {
  resolve(hostname: string): Promise<readonly string[]>;
}

export interface EndpointPolicy {
  allowLocalHttp?: boolean;
  allowedPorts?: readonly number[];
}

export interface ValidatedEndpoint {
  url: string;
  hostname: string;
  addresses: readonly string[];
}

export class SystemEndpointResolver implements EndpointResolver {
  async resolve(hostname: string): Promise<readonly string[]> {
    if (isIP(hostname)) return [hostname];
    const results = await lookup(hostname, { all: true, verbatim: true });
    return [...new Set(results.map((result) => result.address))];
  }
}

export async function validateEndpoint(
  value: string,
  resolver: EndpointResolver = new SystemEndpointResolver(),
  policy: EndpointPolicy = {},
): Promise<ValidatedEndpoint> {
  if (value.length > 2048) throw new EndpointPolicyError('url_too_long');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EndpointPolicyError('invalid_url');
  }
  if (url.username || url.password) throw new EndpointPolicyError('credentials_forbidden');
  if (url.hash) throw new EndpointPolicyError('fragment_forbidden');
  const localHttp = policy.allowLocalHttp === true && url.protocol === 'http:';
  if (url.protocol !== 'https:' && !localHttp) throw new EndpointPolicyError('https_required');
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  const allowedPorts = policy.allowedPorts ?? (localHttp ? [80, port] : [443]);
  if (!allowedPorts.includes(port)) throw new EndpointPolicyError('port_forbidden');
  const addresses = await resolver.resolve(url.hostname);
  if (addresses.length === 0) throw new EndpointPolicyError('dns_empty');
  for (const address of addresses) {
    if (!isIP(address)) throw new EndpointPolicyError('dns_invalid');
    if (isProhibitedAddress(address) && !localHttp)
      throw new EndpointPolicyError('destination_prohibited');
    if (localHttp && !isLoopback(address)) throw new EndpointPolicyError('local_http_not_loopback');
  }
  url.hostname = url.hostname.toLowerCase();
  return { url: url.toString(), hostname: url.hostname, addresses };
}

export class EndpointPolicyError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'EndpointPolicyError';
  }
}

export function isProhibitedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts as [number, number, number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7);
      return isIP(mapped) === 4 ? isProhibitedAddress(mapped) : true;
    }
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
    );
  }
  return true;
}

function isLoopback(address: string): boolean {
  if (address === '::1') return true;
  if (isIP(address) !== 4) return false;
  return address.startsWith('127.');
}
