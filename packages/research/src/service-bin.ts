#!/usr/bin/env node
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
  createResearchHttpServer,
  listenResearchHttp,
} from './index.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'tnl-research is a local deterministic service and cannot start in production. Deploy the research library with production identity, persistence, TNL, Docdex, web, and Codali adapters.',
  );
}
if (process.env.TNL_RESEARCH_DEV_SERVICE !== '1')
  throw new Error(
    'Set TNL_RESEARCH_DEV_SERVICE=1 to start the local deterministic research service.',
  );

const orchestrator = new ResearchOrchestrator({
  adapters: ['tnl', 'docdex', 'web'].map(
    (tool) =>
      new DeterministicEvidenceAdapter(
        tool as 'tnl' | 'docdex' | 'web',
        DETERMINISTIC_RESEARCH_EVIDENCE,
      ),
  ),
  codali: new DeterministicCodaliAdapter(),
});
const server = createResearchHttpServer({
  orchestrator,
  authorize: async (request) => {
    const tenant = request.headers['x-tnl-tenant-id'];
    const actor = request.headers['x-tnl-user-id'];
    if (typeof tenant !== 'string' || typeof actor !== 'string') return undefined;
    return {
      tenantId: tenant,
      actorId: actor,
      scopes: new Set(['research:run', 'research:read', 'research:delete']),
    };
  },
});
const address = await listenResearchHttp(server, {
  host: process.env.TNL_RESEARCH_HOST ?? '127.0.0.1',
  port: Number(process.env.TNL_RESEARCH_PORT ?? 7425),
});
console.log(`TNL research development service listening on http://${address.host}:${address.port}`);
