# TNL Zapier Re-review and Fedia/Mbin Setup Progress

Date: 2026-08-08
Status: In progress

## Zapier

- [x] Capture Abraham D.'s publication-review findings.
- [x] Verify the public developer documentation returns HTTP 200 and contains human-readable
  API, authentication, webhook, integration, and reference pages.
- [x] Confirm the core product brand is **The Neural Ledger**.
- [x] Apply authentication, connection-label, weekly naming, description, and branding fixes.
- [x] Run focused tests, Zapier validation, build, and metadata inspection.
- [x] Upload the corrected integration and update the publication metadata.
- [ ] Reply in the reviewer thread with the completed changes and documentation link.

## Fedia/Mbin

- [ ] Select the target free instance.
- [ ] Verify the dedicated TNL account and public profile.
- [ ] Verify or create a writable TNL magazine/community.
- [ ] Confirm a manual controlled entry can be submitted.
- [ ] Confirm the exact engineering callback URL.
- [ ] Register and authorize a least-privilege private OAuth client.
- [ ] Store secrets securely and record only non-secret identifiers here.
- [ ] Run an approved controlled canary.

## Evidence

- Zapier app: `244155`, linked CLI slug `App244155`, current draft version `1.0.3`.
- Current integration title observed through the Zapier CLI: `TNL Intelligence`.
- Documentation: `https://developers.theneuralledger.com/` returned HTTP 200 on
  2026-08-08; the API reference begins at `/api/news`.
- Repository impact checks found no unresolved imports for the Zapier entry point. The
  metadata modules are imported by `integrations/zapier/index.js` and covered through
  `integrations/zapier/test/app.test.cjs`.
- `docdexd run-tests --target integrations/zapier` passed the full workspace, including
  all five Zapier tests.
- `zapier-platform validate` passed 46 checks with no failures and no publishing warnings.
  The only remaining general warning is the optional 19.0.0 to 19.1.0 platform upgrade.
- Version `1.0.3` was rebuilt and uploaded successfully on 2026-08-08.
- Zapier metadata now reports the title **The Neural Ledger**, a convention-compliant
  description beginning `The Neural Ledger is a`, the `New TNL Weekly Consequential
  Edition` trigger, and the `Create TNL Weekly Edition` action.
- The signed-in Zapier dashboard remains `Pending` and states that the integration was
  successfully submitted. The reviewer email is not present in the signed-in
  `synthomusmagnus@gmail.com` mailbox, so the required reply cannot be sent from that
  account.
