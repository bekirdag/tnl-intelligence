import { TnlClient } from '@theneuralledger/sdk';

export interface ClientEnvironment {
  TNL_API_KEY?: string;
  TNL_BASE_URL?: string;
}

export function clientFromEnvironment(environment: ClientEnvironment = process.env): TnlClient {
  const apiKey = environment.TNL_API_KEY?.trim();
  if (!apiKey) throw new Error('TNL_API_KEY is required');
  return new TnlClient({
    apiKey,
    ...(environment.TNL_BASE_URL ? { baseUrl: environment.TNL_BASE_URL } : {}),
  });
}
