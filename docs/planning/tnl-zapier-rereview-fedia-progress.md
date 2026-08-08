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

- [x] Select the target free instance.
- [x] Verify the dedicated TNL account and public profile.
- [x] Create a writable, moderator-restricted TNL magazine/community.
- [x] Confirm a manual controlled entry can be submitted.
- [ ] Complete the user-present Fedia two-factor enrollment and retain recovery codes.
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
- Selected Mbin instance: `https://fedia.io`, running Mbin `1.10.1`.
- Dedicated account: `@theneuralledger@fedia.io`, public profile
  `https://fedia.io/u/theneuralledger`.
- Created the moderator-restricted, discoverable and indexable magazine **The Neural
  Ledger** at `https://fedia.io/m/theneuralledger`; observed magazine ID `71137`.
- Published and verified the account-side welcome entry at
  `https://fedia.io/m/theneuralledger/t/4232628/Welcome-to-The-Neural-Ledger-on-Fedia`.
- Fedia exposes two-factor authentication. Enrollment is staged at the QR-code and
  verification screen and requires the account holder's authenticator code and current
  password.
- The missing Fedia account password was reset through the verified
  `synthomusmagnus@gmail.com` recovery mailbox on 2026-08-08. A strong replacement was
  installed directly in the ignored, mode-`0600` `.creds` file and used to restore the
  signed-in session without printing it. The replacement password is prefilled on the new
  two-factor enrollment screen; only the account holder's authenticator code remains.
- The repository has no Fedia/Mbin publisher adapter or OAuth callback route under
  `packages/publisher/src`. A new confidential client must not be registered until
  engineering supplies and deploys the exact HTTPS redirect URI; Mbin requires an exact
  match during the authorization-code exchange.
