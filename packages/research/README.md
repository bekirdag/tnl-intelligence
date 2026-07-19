# `@theneuralledger/research`

Shared, evidence-first research contracts and orchestration for The Neural Ledger.

The package contains six immutable research skills, bounded TNL/Docdex/web/Codali
adapters, tenant-scoped result caching, deterministic graders, an authorized HTTP
service boundary, a standalone research workspace, and an MCP App resource.

## Local deterministic service

```bash
npm run build --workspace @theneuralledger/research
TNL_RESEARCH_DEV_SERVICE=1 node packages/research/dist/service-bin.js
```

Open `http://127.0.0.1:7425`. The development entrypoint uses synthetic evidence,
accepts loopback-only development identity headers, and refuses to start when
`NODE_ENV=production`.

Production deployments import `ResearchOrchestrator` into the authenticated TNL
service and provide durable tenant storage plus configured TNL, Docdex, approved
web, and Codali HTTPS adapters. Credentials remain server-side. The research
runtime never shells out from browser code and never modifies BDYA state.

## Result guarantees

- Material factual claims must cite normalized evidence.
- Prompt-like source text is quarantined before synthesis.
- Fact, inference, forecast, and unknown classifications remain structured.
- Event, publication, revision, retrieval, and `asOf` times remain distinct.
- Budgets bound tool calls, duration, tokens, sources, and cost.
- Traces contain stage summaries and provider versions, not hidden reasoning.
- Generated work is identified as `TNL Bot` and is not trading advice.
