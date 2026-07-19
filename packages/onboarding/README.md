# @theneuralledger/onboarding

Local and deployable contracts for TNL developer credentials, static sample data,
the API explorer, quick starts, usage checkpoints, and public-safe Postman assets.

The included CLI uses an explicit development-only header identity adapter and
refuses `NODE_ENV=production`. Production TNL must inject its session identity and
durable credential/audit stores into `createOnboardingServer`; it must not expose
the local header adapter.
