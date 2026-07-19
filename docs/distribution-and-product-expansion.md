# TNL Developer Distribution and Product Expansion Strategy

Date: 2026-07-18

## Objective

Make TNL intelligence available where developers, AI users, analysts, and
quantitative researchers already work. Packages are useful only when they are
easy to discover, install, evaluate, and apply to a concrete workflow. The
distribution strategy therefore has four parts:

1. Publish the existing packages in their native registries.
2. Put the MCP server and API in high-intent directories and marketplaces.
3. Build shared hosted capabilities that unlock one-click integrations.
4. Ship a small number of workflow-specific tools instead of many thin wrappers.

TNL remains a read-only intelligence and evidence layer. None of these tools
should place trades, present TNL as a source of execution-grade prices, or hide
the original story sources.

## How the Existing Packages Expand Reach

| Existing artifact                 | Audience reached                             | Why it helps adoption                                                                                                | Primary discovery path                                              |
| --------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `@theneuralledger/sdk`            | Node.js and TypeScript developers            | Removes authentication, pagination, retry, error, and type-handling work from application integrations               | npm, GitHub, API documentation, code examples                       |
| `@theneuralledger/mcp`            | AI assistants, agent builders, and IDE users | Makes source-linked TNL stories available as agent tools, resources, and prompts at the moment a user is researching | Official MCP Registry, AI connector directories, Cursor and VS Code |
| `@theneuralledger/cli`            | Automation engineers and terminal users      | Supports scripts, scheduled jobs, local caching, and long-running ingestion without application code                 | npm, Homebrew later, GitHub releases, container images              |
| `tnl-intelligence` Python package | Data scientists and quantitative researchers | Provides synchronous and asynchronous access in the Python, notebook, pandas, and backtesting ecosystem              | PyPI, notebooks, QuantConnect examples, data engineering connectors |
| Container image                   | Platform and operations teams                | Makes the HTTP MCP server and daemon deployable without managing a Node.js toolchain                                 | GitHub Container Registry and Docker MCP Catalog                    |

These packages create integration surface, but they will not create material
reach by themselves. Each package needs a searchable listing, a working
five-minute example, and a use-case template that produces a valuable result
before a user has to design an integration.

## Product Priorities

### P0: Shared Distribution Foundation

Build these before adding more marketplace-specific clients.

1. **Public remote MCP gateway**
   - Provide a stable HTTPS Streamable HTTP endpoint.
   - Add OAuth 2.1/OIDC account linking while retaining scoped API keys for
     server-to-server use.
   - Add per-user scopes, quotas, revocation, audit events, request tracing,
     status reporting, privacy policy, and support contact.
   - This is the common foundation for Claude, ChatGPT/Codex, Microsoft 365
     Copilot, Cursor, hosted MCP directories, and browser-based clients.

2. **Webhook and event-delivery API**
   - Emit signed events for new stories, material revisions, asset mentions,
     category changes, and high-impact developments.
   - Support HMAC verification, idempotency keys, retries, replay, delivery
     history, filters, and test events.
   - This is the common trigger layer for Zapier, n8n, Make, Pipedream, team
     notifications, and downstream data pipelines.

3. **Public OpenAPI and Postman experience**
   - Publish the canonical OpenAPI document, generated examples, a Postman
     collection, a safe sample environment, and a browser API explorer.
   - Include copy-paste examples for TypeScript, Python, `curl`, and MCP.
   - Keep authentication, pagination, timestamps, revisions, rate limits, and
     source attribution explicit.

4. **One-click MCP installation**
   - Publish the existing `server.json` to the official MCP Registry.
   - Add an MCPB bundle for compatible desktop clients.
   - Add `vscode:mcp/install`, Cursor, npm, and Docker installation buttons to
     the README and developer site.

5. **Evaluation and sample tier**
   - Offer a bounded developer key or sample dataset with clear licensing and
     rate limits.
   - Provide a no-key demo for a small static dataset so users can validate the
     response model before creating an account.

### P1: High-Leverage Workflow Tools

1. **TNL AI research app**
   - Back it with the remote MCP gateway.
   - Provide interactive story timelines, evidence/source views, asset-impact
     matrices, related developments, and citations.
   - Package the same core experience for ChatGPT/Codex plugins, Claude
     connectors, Cursor, and MCP Apps instead of rebuilding the analysis logic.

2. **TNL research recipe and skill pack**
   - Include workflows for “what changed,” source comparison, event validation,
     asset exposure, geopolitical risk, weekly consequential developments, and
     cited briefing generation.
   - Distribute the recipes inside Cursor and ChatGPT/Codex plugins and as plain
     prompt examples for other MCP clients.

3. **Automation connectors**
   - Start with n8n and Pipedream because they map cleanly to npm code and public
     component registries.
   - Add Zapier after the webhook trigger contract is stable.
   - Add Make after the first connectors confirm which triggers and actions are
     actually used.
   - Standard trigger: new or revised story matching category, geography,
     entity, asset, impact, and confidence filters.
   - Standard actions: search stories, get a story, get related stories, resolve
     an entity or asset, and create a cited intelligence brief.

4. **Quantitative research toolkit**
   - Add optional pandas and Polars outputs, Parquet/DuckDB caching, point-in-time
     timestamps, revision history, entity/asset normalization, and event windows.
   - Include event-study and backtest examples that distinguish `event_at`,
     `published_at`, and revision availability to prevent look-ahead bias.
   - Keep broker and order-execution code outside the project.

5. **Notebook and project templates**
   - Publish Jupyter/Colab notebooks for event studies, asset-impact timelines,
     source-quality analysis, and weekly intelligence summaries.
   - Add a GitHub template or Codespaces configuration that runs against the
     sample tier immediately.

### P2: User-Surface Extensions

1. **Cursor plugin**: bundle MCP configuration, research skills, rules, and
   commands for developers and AI-heavy analysts.
2. **VS Code extension**: build only when it provides a useful timeline,
   source/evidence panel, saved queries, or code annotations. A pure MCP installer
   is redundant with the VS Code MCP gallery.
3. **Browser extension**: add “Analyze with TNL” for the current article, company,
   ticker, or selected text, with a cited side-panel result.
4. **Raycast extension**: provide fast commands for latest developments, story
   search, asset lookup, and saved watches.
5. **Google Sheets add-on**: expose functions and a side panel for analysts who
   need story search and asset/event tables without writing code.
6. **Obsidian plugin**: save source-linked stories and briefs into research notes
   with stable IDs and update/revision handling.

### P3: Data and Enterprise Distribution

1. **QuantConnect data source/vendor integration** for point-in-time event and
   asset-intelligence data once sufficient history and symbol mapping exist.
2. **dlt verified source** for lightweight Python ingestion.
3. **Airbyte source connector** for warehouse ingestion and scheduled incremental
   synchronization.
4. **Grafana data source/app plugin** for operational and risk-monitoring
   dashboards.
5. **Snowflake Marketplace, Databricks Marketplace, and AWS Data Exchange** data
   products after licensing, historical coverage, SLAs, support, and commercial
   packaging are ready.

## Distribution Directory

### Package and API Discovery

| Channel                                                                                                                                      | What to place there                                                            | Main audience                            | Priority | Account or review                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------- | -------- | ------------------------------------------------------------ |
| [npm](https://www.npmjs.com/)                                                                                                                | SDK, MCP server, CLI, and later n8n nodes                                      | JavaScript and agent developers          | P0       | npm owner account; publishing is already prepared            |
| [PyPI](https://pypi.org/)                                                                                                                    | Python SDK and optional quant extras                                           | Python, data science, and quant users    | P0       | PyPI project/trusted publisher                               |
| [GitHub](https://github.com/bekirdag/tnl-intelligence)                                                                                       | Source, releases, templates, examples, discussions, and issue support          | All technical evaluators                 | P0       | Existing repository                                          |
| [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) | Versioned remote MCP/daemon image                                              | Platform teams and self-hosters          | P0       | Existing GitHub owner                                        |
| [Postman Public API Network](https://www.postman.com/publish/)                                                                               | Public workspace, collection, examples, tests, and environment template        | API evaluators and integration teams     | P0       | Postman account and public workspace                         |
| [APIs.guru OpenAPI Directory](https://github.com/APIs-guru/openapi-directory)                                                                | Standards-valid canonical OpenAPI definition                                   | API search engines and code generators   | P1       | GitHub pull request and validation                           |
| [RapidAPI Hub](https://docs.rapidapi.com/docs/hub-listing-overview)                                                                          | Proxied API listing only if TNL wants separate marketplace billing and support | Developers searching for commercial APIs | P3       | Provider account, pricing, support, and auth decision        |
| GitHub Topics and curated developer lists                                                                                                    | Repository metadata and concise project submission                             | Open-source discovery                    | P0       | Add accurate topics; curated lists may require pull requests |

### MCP and AI Marketplaces

| Channel                                                                                                                                     | What to build or submit                                                       | Main audience                            | Priority | Account or review                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- | -------- | ---------------------------------------------------------------- |
| [Official MCP Registry](https://modelcontextprotocol.io/registry/quickstart)                                                                | Existing `server.json` pointing to the published npm package                  | MCP clients and downstream catalogs      | P0       | GitHub auth/namespace verification; package must be public first |
| [Docker MCP Catalog](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/)                                                           | Containerized MCP listing and catalog metadata                                | Docker Desktop and self-hosted MCP users | P0       | Contribution to the Docker MCP registry and verification         |
| [Smithery](https://smithery.ai/docs/build)                                                                                                  | Hosted remote endpoint or MCPB/local server listing                           | Users seeking installable MCP tools      | P0       | Provider account and listing                                     |
| [Glama MCP Directory](https://glama.ai/mcp/hosting)                                                                                         | GitHub repository and remote server metadata                                  | MCP discovery and tool-level search      | P1       | Repository submission                                            |
| [PulseMCP](https://www.pulsemcp.com/submit)                                                                                                 | Public server metadata                                                        | MCP directory users                      | P1       | Manual submission                                                |
| [MCPB](https://github.com/modelcontextprotocol/mcpb)                                                                                        | Signed/verified one-click local bundle                                        | Desktop AI users                         | P0       | Build and release artifact; client-specific review may apply     |
| [VS Code MCP gallery](https://code.visualstudio.com/docs/agent-customization/mcp-servers)                                                   | Registry-backed server listing and one-click install link                     | VS Code agent users                      | P0       | Official MCP Registry publication                                |
| [Cursor Marketplace](https://cursor.com/marketplace)                                                                                        | Plugin containing MCP, skills, rules, and commands                            | Developers using agentic IDE workflows   | P1       | Cursor plugin submission/review                                  |
| [Anthropic Connectors Directory](https://support.anthropic.com/en/articles/11596036-anthropic-connectors-directory-faq)                     | Public remote MCP connector with account linking and support/privacy material | Claude users                             | P1       | Submission and security/product review                           |
| [ChatGPT and Codex Plugin Directory](https://help.openai.com/en/articles/20001256)                                                          | Plugin containing the TNL MCP app and reusable intelligence skills            | ChatGPT and Codex users                  | P1       | OpenAI developer account and review                              |
| [OpenAI Apps SDK](https://help.openai.com/en/articles/12515353)                                                                             | Rich MCP-backed timeline, evidence, and asset-impact UI inside the plugin     | Users who need visual, cited research    | P1       | App/plugin submission and review                                 |
| [Microsoft 365 Copilot federated connectors](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/submit-federated-connector) | Read-only remote MCP search/fetch connector                                   | Enterprise Microsoft users               | P2       | Public HTTPS service and Microsoft review                        |
| [Microsoft 365 Copilot Agent Store](https://learn.microsoft.com/en-us/microsoft-365/copilot/copilot-agent-store)                            | TNL research/monitoring agent after connector approval                        | Business analysts and enterprise teams   | P2       | Tenant/developer account and store governance                    |

### Automation and Data Tool Libraries

| Channel                                                                                                                   | What to build                                                                | Main audience                          | Priority | Account or review                                                |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------- | -------- | ---------------------------------------------------------------- |
| [n8n community nodes](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)                     | `n8n-nodes-tnl` trigger and actions                                          | Self-hosted automation users           | P1       | npm package; verification for n8n Cloud visibility               |
| [Pipedream component registry](https://pipedream.com/docs/components)                                                     | Story event source plus search/get/brief actions                             | Developers building event workflows    | P1       | Pipedream account and component contribution/review              |
| [Zapier public integrations](https://docs.zapier.com/integrations/quickstart/private-vs-public-integrations)              | Public TNL app using webhooks and API actions                                | Broad no-code business audience        | P1       | Zapier developer account, users, testing, and publication review |
| [Make Apps Marketplace](https://developers.make.com/custom-apps-documentation/apps-marketplace/how-does-it-work)          | Public community app using the same trigger/action contract                  | Visual automation users                | P2       | Make developer account and marketplace review                    |
| [dlt verified sources](https://dlthub.com/docs/dlt-ecosystem/verified-sources)                                            | Incremental Python source with schema and state handling                     | Python data engineers                  | P2       | Open-source contribution/review                                  |
| [Airbyte Connector Catalog](https://github.com/airbytehq/airbyte/blob/master/docs/integrations/README.md)                 | Source connector with incremental sync and schema discovery                  | Data platform and warehouse teams      | P2       | Connector contribution, tests, and catalog review                |
| [Grafana Plugin Catalog](https://grafana.com/developers/plugin-tools/publish-a-plugin/publish-a-plugin)                   | TNL data source or app plugin                                                | Monitoring and risk teams              | P2       | Signed plugin and Grafana review                                 |
| [GitHub Marketplace](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace) | Separate “TNL Intelligence Gate” action for scheduled/PR/release risk briefs | Software and release engineering teams | P2       | Separate public action repository with root `action.yml`         |

### Developer and Analyst Extensions

| Channel                                                                                               | Useful TNL experience                                                  | Main audience                              | Priority | Account or review                                          |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ | -------- | ---------------------------------------------------------- |
| [VS Code Marketplace](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) | Timeline/evidence panel, saved searches, and source-linked annotations | Developers and technical analysts          | P2       | Microsoft publisher and extension review                   |
| [Open VSX Registry](https://open-vsx.org/)                                                            | Compatible build of the VS Code extension                              | VSCodium and compatible editor users       | P2       | Eclipse/Open VSX publisher namespace                       |
| [Chrome Web Store](https://developer.chrome.com/docs/webstore/publish/)                               | “Analyze this page with TNL” side-panel extension                      | Researchers reading news and company pages | P2       | Developer account, privacy disclosures, and review         |
| [Raycast Store](https://developers.raycast.com/basics/publish-an-extension)                           | Search, latest developments, asset lookup, and saved-watch commands    | Desktop power users                        | P2       | Raycast account and pull-request review                    |
| [JetBrains Marketplace](https://plugins.jetbrains.com/docs/marketplace/uploading-a-new-plugin.html)   | Research tool window and MCP setup                                     | JetBrains IDE users                        | P3       | JetBrains vendor account and review                        |
| [Obsidian Community Plugins](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)       | Save and update cited intelligence notes                               | Researchers and knowledge workers          | P3       | GitHub release and community-plugin submission             |
| [Google Workspace Marketplace](https://developers.google.com/workspace/marketplace/how-to-publish)    | Sheets functions and an analyst side panel                             | Spreadsheet-based analysts                 | P2       | Google Cloud project, OAuth review, and marketplace review |

### Quant, Dataset, and Enterprise Marketplaces

| Channel                                                                                                    | What to place there                                         | Main audience                             | Priority | Readiness gate                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| [QuantConnect Dataset Market](https://www.quantconnect.com/docs/v2/cloud-platform/datasets/vendors)        | Point-in-time TNL event/asset data source and LEAN examples | Algorithmic traders and quant researchers | P2       | Historical depth, symbol mapping, reliable delivery, documentation, and vendor review |
| [Hugging Face Datasets](https://huggingface.co/docs/hub/en/datasets-adding)                                | Licensed sample/benchmark dataset and dataset card          | ML researchers and model builders         | P2       | Source-content rights, privacy, license, provenance, and update policy                |
| [Snowflake Marketplace](https://docs.snowflake.com/en/collaboration/provider-listings-creating-publishing) | Governed live data share or paid listing                    | Enterprise data teams                     | P3       | Provider profile, commercial terms, regional availability, SLA, and review            |
| [Databricks Marketplace](https://docs.databricks.com/aws/en/marketplace/get-started-provider)              | Delta Sharing data product and notebooks                    | Lakehouse and ML teams                    | P3       | Provider approval, data product, documentation, and support                           |
| [AWS Data Exchange](https://docs.aws.amazon.com/data-exchange/latest/userguide/publish-API-product.html)   | API or dataset product                                      | AWS enterprise buyers                     | P3       | AWS Marketplace provider status, contracts, metering, support, and review             |

## Publication Runbooks

These runbooks use the repository and release configuration that exists on
2026-07-18. Recheck the linked platform documentation before a later launch
because marketplace forms and review rules change.

### Current Account State

| Service         | State verified on this machine               | Action                                                                                                      |
| --------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GitHub          | Authenticated as `bekirdag`                  | Use this existing account and repository. Do not create another GitHub account.                             |
| npm             | Account `bekirdag` exists; CLI login expired | Run `npm login` and confirm `npm whoami` returns `bekirdag` before creating the organization or publishing. |
| PyPI            | Not verified                                 | Use an existing TNL-owned PyPI account if one exists; otherwise create a separate PyPI account.             |
| All other sites | Not verified                                 | Follow the account decision table below. Do not assume a personal account should own a company listing.     |

### Account Decision Table

| Platform                       | Account required                                                                      | Account to use or create                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GitHub and GHCR                | GitHub                                                                                | Use the existing `bekirdag` GitHub account.                                                                                   |
| npm                            | npm account and `theneuralledger` npm organization                                    | Use `bekirdag`; create the organization if it does not exist. Google and Microsoft accounts are not required.                 |
| PyPI                           | Separate PyPI account                                                                 | Use a TNL-owned PyPI account or register one with a company-controlled email. GitHub, Google, and Microsoft are not required. |
| Official MCP Registry          | Domain ownership for the current namespace                                            | No new marketplace account. Authenticate `theneuralledger.com` with DNS and a signing key.                                    |
| Postman                        | Postman account                                                                       | Prefer **Continue with GitHub** using `bekirdag`, or use a company Google Workspace account if TNL already has one.           |
| Docker MCP Catalog             | GitHub for the contribution; Docker account only for Desktop/Hub testing              | Use `bekirdag` for the pull request. If needed, create Docker with **Continue with GitHub**.                                  |
| Smithery                       | Smithery account/API identity                                                         | Run `smithery auth login` and complete its browser login. Use the TNL owner identity.                                         |
| Glama                          | GitHub OAuth with repository write/admin access                                       | Sign in with the existing `bekirdag` GitHub account.                                                                          |
| PulseMCP                       | No separate publisher account is currently advertised                                 | Use the submission form only if the registry-fed listing does not appear; provide a TNL-controlled email if requested.        |
| VS Code MCP gallery            | No separate Microsoft publisher account                                               | Publishing to the official MCP Registry supplies the gallery entry.                                                           |
| Cursor Marketplace             | Cursor account                                                                        | Use an existing Cursor account, or create one using the existing GitHub identity. A Microsoft account is not required.        |
| ChatGPT/Codex Plugin Directory | OpenAI Platform account and publishing organization                                   | Use an existing OpenAI login if it owns the correct organization; otherwise create a company-owned OpenAI account.            |
| APIs.guru                      | GitHub                                                                                | Use `bekirdag` to submit a pull request.                                                                                      |
| n8n Creator Portal             | n8n Creator account plus GitHub and npm                                               | Register a company-owned creator account; continue using `bekirdag` and the TNL npm organization for source and artifacts.    |
| Pipedream                      | Pipedream and GitHub                                                                  | Create a Pipedream account with a TNL-controlled email and use `bekirdag` for the public registry pull request.               |
| Zapier                         | Zapier developer account                                                              | Use or create a TNL-owned Zapier account with a company-domain email. Google or Microsoft login is optional, not required.    |
| Rich VS Code extension, later  | Microsoft account, Azure DevOps organization, and Visual Studio Marketplace publisher | Create these only after the extension has useful editor-native UI. They are not required for the MCP gallery.                 |

### Shared Ownership and Security Setup

Complete these steps once before creating new marketplace accounts:

1. Use an email address and domain controlled by TNL for every new account.
2. Store passwords, recovery codes, API tokens, and signing-key backups in the
   team password manager. Never place them in this repository, an issue, a pull
   request, a Postman environment, or marketplace listing text.
3. Enable two-factor authentication on GitHub, npm, PyPI, OpenAI, Postman,
   Docker, Cursor, n8n, Pipedream, and Zapier when offered.
4. Add one backup company owner after the listing works. Do not make an agency,
   contractor, or personal email the only owner.
5. Record the account email, organization/workspace name, public listing URL,
   billing owner, recovery owner, and renewal date in the password manager.
6. Prefer GitHub Actions OIDC/trusted publishing over long-lived npm or PyPI
   tokens. Restrict production publishing with GitHub environments and required
   reviewers.
7. Never publish a real `TNL_API_KEY` in examples. Use `TNL_API_KEY` as a
   placeholder or a deliberately bounded demo key that can be revoked.

### 1. Configure GitHub Release Controls and GHCR

**Account:** use the existing GitHub account `bekirdag`. No Microsoft or Google
account is needed.

1. Open the repository's [environment settings](https://github.com/bekirdag/tnl-intelligence/settings/environments).
2. Create environments named exactly `npm`, `pypi`, and `mcp-registry`. The
   workflow names are case-sensitive.
3. For each environment, add a required reviewer if the GitHub plan exposes that
   control. Select the TNL owner and prevent self-review when a backup owner is
   available.
4. Restrict deployment branches to the protected default branch.
5. Open the repository's [Actions page](https://github.com/bekirdag/tnl-intelligence/actions)
   and confirm these workflows are visible: **Release npm packages**,
   **Release Python package**, **Release MCP Registry metadata**, and
   **Release container**.
6. Run the container workflow only after the repository validation passes. Open
   **Release container**, select **Run workflow**, choose the default branch,
   enter the package version such as `0.1.0`, and confirm.
7. When the run succeeds, open the `tnl-intelligence` package from the
   [GitHub Packages page](https://github.com/bekirdag?tab=packages). If it is
   private, open **Package settings** > **Change visibility** > **Public** and
   type the package name to confirm.
8. In **Package settings**, connect the package to the
   `bekirdag/tnl-intelligence` repository if GitHub did not link it automatically.
9. Verify both tags from a clean Docker installation:

   ```bash
   docker pull ghcr.io/bekirdag/tnl-intelligence:0.1.0
   docker pull ghcr.io/bekirdag/tnl-intelligence:latest
   ```

10. Record the public package URL and successful workflow run URL in the release
    log.

Reference: [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
and [package visibility](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).

### 2. Publish the JavaScript Packages to npm

**Account:** use npm user `bekirdag`. npm has its own account system; a Google or
Microsoft account is not required.

#### Create or confirm the npm organization

1. Open [npm login](https://www.npmjs.com/login) and sign in as `bekirdag`. If
   the password or two-factor method is unavailable, recover this account rather
   than creating another account with the same intended ownership.
2. In the terminal, refresh the CLI session and verify the identity:

   ```bash
   npm login
   npm whoami
   ```

   The second command must print `bekirdag`.

3. Open [`https://www.npmjs.com/org/theneuralledger`](https://www.npmjs.com/org/theneuralledger).
   If the organization exists and `bekirdag` is an owner, continue.
4. If it does not exist, open the npm profile menu, select **Add Organization**,
   enter `theneuralledger`, choose the free plan for unlimited public packages,
   and finish organization creation.
5. Open the organization member settings and confirm `bekirdag` is an owner. Add
   a backup TNL owner only after their npm account has 2FA enabled.

#### Bootstrap unpublished package names if necessary

npm trusted publishers are configured from an existing package's settings. For
each package, first open its expected page:

- [`@theneuralledger/sdk`](https://www.npmjs.com/package/@theneuralledger/sdk)
- [`@theneuralledger/mcp`](https://www.npmjs.com/package/@theneuralledger/mcp)
- [`@theneuralledger/cli`](https://www.npmjs.com/package/@theneuralledger/cli)

If all pages exist and are owned by `theneuralledger`, skip this bootstrap. If a
page does not exist and npm does not offer trusted-publisher setup before the
first release, perform the first owner-controlled publication once:

1. From the repository root, run the full validation and package inspection:

   ```bash
   npm ci
   npm run validate
   npm run pack:check
   ```

2. Confirm every package version is `0.1.0` and the package tarballs contain only
   intended files.
3. Publish in dependency order. Enter the current npm one-time password when npm
   requests it; do not save the code in shell history or the repository.

   ```bash
   npm publish --workspace @theneuralledger/sdk --access public
   npm publish --workspace @theneuralledger/mcp --access public
   npm publish --workspace @theneuralledger/cli --access public
   ```

4. Do not repeat a partial publication blindly. Check `npm view <package>
version` after each command and continue with only the missing packages.

#### Configure trusted publishing for future releases

1. Open each package page, select **Settings**, find **Trusted Publisher**, and
   select **GitHub Actions**.
2. Enter these exact values for all three packages:

   | Field                | Value              |
   | -------------------- | ------------------ |
   | Organization or user | `bekirdag`         |
   | Repository           | `tnl-intelligence` |
   | Workflow filename    | `release-npm.yml`  |
   | Environment name     | `npm`              |
   | Allowed action       | `npm publish`      |

3. Save the trusted publisher separately on each package. npm permits only one
   trusted publisher configuration per package.
4. After one OIDC release succeeds, restrict or revoke old write-capable npm
   automation tokens. Retain only tokens that are still needed for unrelated
   packages.
5. For later versions, update all workspace versions and exact internal
   dependency versions in one pull request, merge it, then open
   [GitHub Actions](https://github.com/bekirdag/tnl-intelligence/actions/workflows/release-npm.yml).
6. Select **Run workflow**, choose the default branch, enter the exact version
   present in `packages/sdk/package.json`, and approve the `npm` environment.
7. Verify the release and provenance:

   ```bash
   npm view @theneuralledger/sdk version dist.integrity
   npm view @theneuralledger/mcp version dist.integrity
   npm view @theneuralledger/cli version dist.integrity
   npx -y @theneuralledger/cli@0.1.0 --help
   ```

The existing workflow uses Node 24 and `id-token: write`, satisfying the current
[npm trusted-publisher requirements](https://docs.npmjs.com/trusted-publishers/).

### 3. Publish the Python Package to PyPI

**Account:** PyPI requires a separate PyPI identity. GitHub, npm, Google, and
Microsoft logins do not replace it.

1. Open [PyPI registration](https://pypi.org/account/register/). If TNL already
   has a PyPI account, sign in instead and confirm the company controls its email
   and recovery method.
2. If creating an account, use a TNL-controlled email, verify the email message,
   sign in, enable 2FA, and store the recovery codes in the password manager.
3. Open **Account settings** > **Publishing**. Under **Add a new pending
   publisher**, select **GitHub** and enter:

   | Field             | Value                |
   | ----------------- | -------------------- |
   | PyPI project name | `tnl-intelligence`   |
   | GitHub owner      | `bekirdag`           |
   | GitHub repository | `tnl-intelligence`   |
   | Workflow filename | `release-python.yml` |
   | Environment name  | `pypi`               |

4. Save the pending publisher. This does not reserve the project name; publish
   promptly after checking that [`tnl-intelligence`](https://pypi.org/project/tnl-intelligence/)
   is still available or correctly owned.
5. Open the [Python release workflow](https://github.com/bekirdag/tnl-intelligence/actions/workflows/release-python.yml),
   select **Run workflow**, choose the default branch, enter `0.1.0`, and approve
   the `pypi` environment.
6. Confirm the workflow passes Ruff, mypy, pytest, build, and the PyPI upload.
7. Open the PyPI project page. Confirm the description, repository link, Python
   requirement, files, hashes, and trusted-publisher provenance are present.
8. Verify from a new virtual environment rather than the repository checkout:

   ```bash
   python3 -m venv /tmp/tnl-pypi-check
   /tmp/tnl-pypi-check/bin/pip install tnl-intelligence==0.1.0
   /tmp/tnl-pypi-check/bin/python -c "import tnl_intelligence; print(tnl_intelligence.__name__)"
   ```

9. Once the pending publisher has created the project, open the project's
   **Manage** > **Publishing** page and verify the publisher is now attached to
   the project.

Reference: [create a project with a pending trusted publisher](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/)
and [publish with OIDC](https://docs.pypi.org/trusted-publishers/using-a-publisher/).

### 4. Publish to the Official MCP Registry

**Account:** no new marketplace account is needed. The registry name is
`com.theneuralledger/intelligence`, so ownership is proven through DNS for
`theneuralledger.com`, not through a GitHub namespace.

Complete npm publication first. The registry stores metadata and must be able to
verify the public `@theneuralledger/mcp` package.

1. Confirm the package and metadata versions match:

   ```bash
   npm view @theneuralledger/mcp version
   node -p "require('./server.json').version"
   node -p "require('./packages/mcp/package.json').mcpName"
   ```

   Expected results are `0.1.0`, `0.1.0`, and
   `com.theneuralledger/intelligence` for the first release.

2. On an offline or otherwise controlled machine, generate the registry key:

   ```bash
   openssl genpkey -algorithm Ed25519 -out mcp-registry-key.pem
   PUBLIC_KEY="$(openssl pkey -in mcp-registry-key.pem -pubout -outform DER | tail -c 32 | base64)"
   PRIVATE_KEY="$(openssl pkey -in mcp-registry-key.pem -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
   printf 'v=MCPv1; k=ed25519; p=%s\n' "$PUBLIC_KEY"
   ```

3. Sign in to the DNS provider authoritative for `theneuralledger.com`. No
   Microsoft or Google account is required unless that DNS provider itself uses
   one for login.
4. Add a TXT record at the root domain. Most DNS consoles use host/name `@`;
   enter the printed `v=MCPv1; ...` string as the value. Do not publish the
   private key.
5. Wait for propagation and verify from two networks or resolvers:

   ```bash
   dig +short TXT theneuralledger.com
   ```

6. Open GitHub **Settings** > **Environments** > `mcp-registry` >
   **Environment secrets** > **Add secret**.
7. Create `MCP_DNS_PRIVATE_KEY` and paste the hexadecimal value held in
   `$PRIVATE_KEY`, not the PEM file and not the public key.
8. Store an encrypted recovery copy of the PEM in the password manager, close the
   controlled shell, and remove any unencrypted temporary key file after the
   secret and recovery copy have been verified.
9. Open [Release MCP Registry metadata](https://github.com/bekirdag/tnl-intelligence/actions/workflows/release-mcp.yml),
   select **Run workflow**, choose the default branch, enter `0.1.0`, and approve
   the `mcp-registry` environment.
10. The workflow validates `server.json`, authenticates the domain, and publishes
    the metadata. If it reports a namespace error, recheck the TXT record and the
    exact private-key format before rotating anything.
11. Verify the public API result:

    ```bash
    curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=com.theneuralledger%2Fintelligence"
    ```

12. Confirm the returned name, version, repository, npm package, environment
    variables, and `stdio` transport are correct.

Reference: [MCP Registry quickstart](https://modelcontextprotocol.io/registry/quickstart)
and [DNS authentication](https://modelcontextprotocol.io/registry/authentication).

### 5. Publish a Postman Public API Workspace

**Account:** a Postman account is required. The simplest ownership path is
**Continue with GitHub** using `bekirdag`. Postman also offers Google and work
email sign-up; use a company Google Workspace account only if TNL already has and
administers one. A Microsoft account is not required.

1. Open [Postman sign-up](https://identity.getpostman.com/signup). Select
   **Continue with GitHub**, authorize Postman for the existing GitHub identity,
   and complete email verification if requested.
2. Create or select a TNL team. Create an **Internal** workspace named
   `The Neural Ledger API` first so the collection can be reviewed before it is
   public.
3. Add the workspace summary, full description, TNL website, public support URL,
   repository URL, privacy policy, and terms URL.
4. Import the canonical OpenAPI file from the repository. Do not maintain a
   separate hand-written schema in Postman.
5. Generate or update the `TNL Intelligence API` collection from the OpenAPI
   definition. Group requests by resource and give every request a useful
   description and a successful example response.
6. Create a public-safe environment template with variables such as
   `TNL_BASE_URL=https://theneuralledger.com` and `TNL_API_KEY=`. Set the API key
   to an empty initial value and current value. Never sync a production key.
7. Add collection tests that assert a successful status, JSON content type, and
   the minimum stable response shape. Keep tests tolerant of live news content.
8. Fork or export the workspace into a separate account and run every request as
   a user would. Confirm authentication instructions, pagination, rate-limit
   behavior, timestamps, revisions, and source attribution are understandable.
9. Open **Workspace options** > **Workspace overview** > **Settings**. Under
   **Workspace type**, select **Change**, choose **Public**, complete any review
   prompt, and save.
10. Open the public workspace in an incognito browser. Confirm no private
    environments, tokens, internal URLs, unpublished endpoints, or team-only
    comments are visible.
11. Copy the stable public workspace URL into the repository README and developer
    documentation. Add a **Run in Postman** button only after the incognito test
    succeeds.
12. Search the [Postman Public API Network](https://www.postman.com/explore) for
    `The Neural Ledger` and verify the workspace, collection, examples, and owner
    appear as expected.

Reference: [prepare a public workspace](https://learning.postman.com/docs/postman-api-network/showcase/prepare/public-workspace/)
and [publish public APIs](https://learning.postman.com/docs/postman-api-network/showcase/publish/public-apis).

### 6. Submit to the Docker MCP Catalog

**Account:** the catalog submission is a GitHub pull request, so use the existing
`bekirdag` account. A Docker account is useful for Docker Desktop and Docker Hub
testing but is not the owner of the catalog pull request.

1. If Docker Desktop/Hub testing is needed, open [Docker sign-up](https://app.docker.com/signup)
   and select **Continue with GitHub**. Authorize the existing GitHub identity.
   Do not create a second Docker identity with an unrelated personal email.
2. Confirm the public GHCR image starts correctly and exposes only the intended
   MCP/daemon interface. Test with a bounded TNL API key.
3. Open the [Docker MCP Registry](https://github.com/docker/mcp-registry), read
   its current `CONTRIBUTING.md`, and search existing servers for `tnl`,
   `theneuralledger`, and `The Neural Ledger` before adding a new entry.
4. Select **Fork** in GitHub and create the fork under `bekirdag`.
5. Clone the fork into a separate working directory. Do not copy Docker's entire
   registry into this repository.
6. Create the TNL server entry using the current schema and directory pattern in
   Docker's repository. Use the source repository, public documentation, license,
   `TNL_API_KEY` secret declaration, and a read-only description.
7. Prefer Docker's supported source-build path for a local server so Docker can
   build, scan, sign, and publish the image under its catalog namespace. Do not
   assume the GHCR image alone satisfies catalog verification.
8. Run every validation and test command documented in Docker's current
   `CONTRIBUTING.md`. Start the resulting server through Docker MCP Toolkit and
   call at least one search and one story-detail tool.
9. Commit only the TNL catalog entry and required metadata. Push the branch to
   the fork and open a pull request against `docker/mcp-registry`.
10. In the pull request, provide the source repository, published npm/MCP
    metadata, test evidence, license, support contact, and an explicit statement
    that the tools are read-only.
11. Address Docker's review and automated checks. Do not change secrets to plain
    configuration values to make a check pass.
12. After merge, allow the catalog propagation window, then verify the listing in
    [Docker Hub MCP](https://hub.docker.com/mcp) and Docker Desktop
    **MCP Toolkit** > **Catalog**. Install it into a new profile and run a tool.

Docker currently states that an approved server appears in the catalog, Docker
Desktop, and the `mcp` namespace within about 24 hours. Treat that as a target,
not an SLA. Reference: [Docker MCP Catalog](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/).

### 7. Publish on Smithery

**Account:** a Smithery identity is required. Its CLI opens the supported browser
authentication flow; use the TNL owner identity. No Microsoft account is
specifically required.

Smithery publication should wait until TNL has either a production Streamable
HTTP MCP URL or a tested MCPB bundle. The current npm-only `stdio` package is not
a remote URL.

1. Install the current Smithery CLI and authenticate:

   ```bash
   npm install -g smithery@latest
   smithery auth login
   smithery auth whoami
   ```

2. When the browser opens, sign in or create the Smithery account with a
   TNL-controlled identity. Return to the terminal and confirm `whoami` shows the
   intended owner.
3. Create the globally unique lowercase namespace:

   ```bash
   smithery namespace create theneuralledger
   ```

   If it is already owned by the correct account, use it. If it is owned by
   someone else, stop and resolve the trademark/ownership issue instead of using
   a misleading variation.

4. For a remote listing, confirm the production URL uses HTTPS Streamable HTTP,
   returns `401` rather than `403` for missing authentication, and completes the
   intended OAuth or credential flow.
5. Publish the remote server using the exact production MCP URL:

   ```bash
   smithery mcp publish "https://<production-host>/<mcp-path>" \
     -n @theneuralledger/tnl-intelligence
   ```

6. If TNL publishes an MCPB bundle instead, follow Smithery's current bundle
   publication command and upload the release artifact generated by CI, not an
   untracked local build.
7. Complete the listing description, repository, website, license, support,
   privacy, authentication, tool descriptions, categories, and icon.
8. Allow Smithery's scan to complete. Inspect every discovered tool and correct
   metadata in the server rather than editing the listing to conceal a mismatch.
9. From a separate Smithery account or clean client, follow the public install
   flow, authenticate, search stories, retrieve a story, and confirm citations
   and errors are readable.
10. Add the Smithery listing URL to the README only after the clean-account test
    succeeds.

Reference: [Smithery publishing](https://smithery.ai/docs/build/publish) and
[namespace rules](https://smithery.ai/docs/concepts/namespaces).

### 8. Submit to Glama

**Account:** Glama uses GitHub authorization and verifies repository access. Use
`bekirdag`, which owns the public source repository. No Google or Microsoft
account is needed.

1. Open the [Glama MCP server directory](https://glama.ai/mcp/servers).
2. Select **Add Server** and then **Continue with GitHub** or the equivalent
   GitHub authorization button.
3. Authorize Glama for `bekirdag/tnl-intelligence`. Grant only the repository
   access needed for verification; Glama requires write or admin access to prove
   ownership even though the repository is public.
4. Select the `tnl-intelligence` repository and provide the production remote
   endpoint or the public npm/server metadata requested by the current form.
5. Use `The Neural Ledger Intelligence` as the title and keep the description
   explicit that access is read-only, source-linked intelligence rather than a
   trading execution service.
6. Add the website, repository, license, support, privacy policy, and exact API
   key or OAuth setup instructions. Do not paste an API key into the form.
7. Submit the listing and wait for indexing/scanning.
8. Open the public listing while signed out. Verify repository ownership,
   transport, tools, health, configuration fields, and links.
9. Connect from a clean MCP client through the listing and run a search plus story
   retrieval before linking the listing from TNL documentation.

Glama hosting is optional and is not needed when TNL operates its own remote MCP
gateway. Reference: [Glama MCP hosting and repository connection](https://glama.ai/mcp/hosting).

### 9. Confirm or Submit the PulseMCP Listing

**Account:** PulseMCP currently accepts a manual submission and also ingests the
official MCP Registry. It does not advertise a separate publisher account for
the submission form.

1. Publish to the official MCP Registry first.
2. Wait for directory ingestion, then search [PulseMCP](https://www.pulsemcp.com/)
   for `The Neural Ledger`, `tnl`, and
   `com.theneuralledger/intelligence`.
3. If the correct listing exists, verify its repository, npm identifier, version,
   transport, description, and installation instructions. Do not submit a
   duplicate.
4. If the listing is missing or the site provides a claim/correction path, open
   the [PulseMCP submission form](https://www.pulsemcp.com/submit).
5. Enter the canonical server name, repository, official Registry identifier,
   npm package, production endpoint if available, short description, categories,
   and a TNL-controlled contact email.
6. Submit once. Save the confirmation or ticket reference in the release log.
7. Recheck the directory after its stated review window and test every install
   link from a signed-out browser.

### 10. Make TNL Discoverable in the VS Code MCP Gallery

**Account:** no Microsoft publisher account is required for this path. VS Code's
MCP discovery uses registry-backed server metadata. A Microsoft account becomes
necessary only if TNL later ships a full Visual Studio Marketplace extension.

1. Finish npm and official MCP Registry publication.
2. Install the current stable VS Code release. Open **Extensions** and search
   `@mcp` followed by `The Neural Ledger`.
3. Open the listing and verify the displayed source, package, description,
   version, configuration inputs, and publisher identity.
4. Select **Install** in a clean VS Code profile. Enter a bounded test API key
   only through VS Code's configuration/input flow; never embed a key in the
   install URL.
5. Start the server, run **MCP: List Servers**, inspect output for startup errors,
   and invoke a TNL story search in agent mode.
6. Generate a web install link from a tested configuration. The object must use
   the actual npm package and must not contain a real secret:

   ```js
   const config = {
     name: 'tnl-intelligence',
     command: 'npx',
     args: ['-y', '@theneuralledger/mcp@0.1.0'],
   };

   const installUrl = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
   ```

7. Add the generated `vscode:mcp/install?...` URL to the README and developer
   site. Keep the readable manual configuration immediately below it for users
   who want to inspect the command before installation.
8. Test the button in stable VS Code and VS Code Insiders. Use
   `vscode-insiders:mcp/install` only for a separate Insiders link.
9. Re-test search, installation, and one tool call after every Registry metadata
   or package-version update.

Reference: [VS Code MCP gallery and configuration](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
and [MCP install URLs](https://code.visualstudio.com/api/extension-guides/ai/mcp).

### 11. Submit a Cursor Marketplace Plugin

**Account:** a Cursor account is required. Use an existing company-controlled
Cursor account if available. Otherwise open [Cursor](https://cursor.com/), choose
sign-up/sign-in, and use the existing GitHub identity where offered. A Microsoft
account is not required.

Do not submit a plugin that only duplicates the MCP install command. Bundle TNL's
tested MCP configuration with useful research skills, rules, or commands.

1. Sign in to Cursor and confirm the account email and recovery method are under
   TNL control.
2. Read the current marketplace plugin specification and create the required
   plugin metadata in a dedicated directory or repository. Do not invent a
   manifest from an older marketplace example.
3. Include the TNL MCP configuration without a real API key. Define the key as a
   user-supplied secret and link to account/key creation instructions.
4. Bundle the first research workflows: source comparison, consequential
   developments, asset exposure, event validation, and cited weekly briefing.
5. Add a public README, icon, license, privacy policy, support URL, repository,
   version, screenshots, and a concise statement that the plugin is read-only.
6. Install the plugin locally using Cursor's current development workflow. Test
   every command and skill in a fresh project and with an account that has no
   cached TNL configuration.
7. Confirm negative cases: missing key, invalid key, rate limit, no search result,
   unavailable upstream source, and malformed user query.
8. Open [Cursor Marketplace submission](https://cursor.com/marketplace/publish),
   sign in, select **Publish a Plugin**, and supply the repository or package
   location requested by the form.
9. Enter the final listing metadata, support and privacy URLs, categories,
   screenshots, setup steps, and test instructions. Accept the marketplace terms
   only after the listed data practices match TNL's production behavior.
10. Submit for review and address reviewer feedback in source-controlled changes.
    Do not make untracked marketplace-only behavior changes.
11. After approval, install the public listing into a clean Cursor profile and
    run each included workflow before adding the marketplace badge to the README.

### 12. Submit a ChatGPT/Codex Plugin

**Account:** an OpenAI Platform account and publishing organization are required.
Use the existing OpenAI/ChatGPT login only if it owns the organization that
should publish TNL. Otherwise create a company-controlled account at
[OpenAI Platform](https://platform.openai.com/). A Microsoft or Google account is
not inherently required; use whichever existing sign-in method is already tied
to the correct OpenAI organization.

This submission waits for the public HTTPS MCP gateway, production authentication,
privacy/support pages, and review credentials. The local npm `stdio` server is
not sufficient.

1. Sign in to [OpenAI Platform](https://platform.openai.com/) and select the
   organization that will own the public plugin.
2. Open organization settings and complete individual verification if publishing
   personally, or business verification if publishing as The Neural Ledger.
   The verified identity must match the listing name, website, support, privacy,
   and terms.
3. Open the organization's role settings. Organization owners already have the
   required access. For another submitter, edit or create a role, set
   **Apps Management** to **Write**, save, and assign the role.
4. Prepare the submission kit: name, short and long descriptions, square logo,
   category, website, support URL, privacy policy, terms, release notes, country
   availability, public MCP URL, authentication instructions, and reviewer demo
   credentials.
5. Review every MCP tool annotation. Set `readOnlyHint`, `openWorldHint`, and
   `destructiveHint` from actual behavior. TNL retrieval tools should be
   read-only, but annotations must be checked tool by tool.
6. Prepare exactly five positive tests and three negative tests with prompts and
   expected outcomes. Cover citations, current-data lookup, an empty result,
   invalid authentication, and a request outside TNL's trading/non-advice
   boundary.
7. Ensure reviewer credentials do not expire during review, do not require email,
   SMS, or MFA access from the reviewer, and expose only bounded test data.
8. Open the [plugin submission portal](https://platform.openai.com/apps-manage)
   and select **Create plugin**.
9. Choose an MCP-backed app plus skills when the TNL research skills are ready.
   Do not reference an already-published ChatGPT app; submit the MCP server itself
   through this flow.
10. Complete listing information and select the verified developer identity.
11. Enter the public MCP URL, authentication details, content security policy,
    and domain ownership challenge. Host the generated challenge exactly where
    the portal requests it and verify it over public HTTPS.
12. Select **Scan Tools**. Compare the detected names, descriptions, inputs,
    outputs, and annotations with the source server and fix discrepancies at the
    server.
13. Upload the versioned skills bundle, add starter prompts, enter all eight test
    cases, choose country availability, complete policy attestations, and add
    review notes.
14. Submit for review. Monitor the portal with the same organization and respond
    to requested changes.
15. Approval does not necessarily publish automatically. When the portal exposes
    **Publish**, have the release owner perform the final action.
16. Install the public plugin from a non-owner account and validate authentication,
    tool selection, citations, source links, privacy/support links, and all starter
    prompts.

Reference: [OpenAI plugin submission guide](https://learn.chatgpt.com/docs/submit-plugins).

### 13. Submit the OpenAPI Definition to APIs.guru

**Account:** only the existing GitHub account is required.

1. Confirm the public OpenAPI URL is stable, HTTPS, and serves a standards-valid
   document without authentication.
2. Run the repository's OpenAPI validation and check that descriptions, license,
   contact, server URL, authentication, schemas, pagination, and examples contain
   no private values.
3. Open the [APIs.guru OpenAPI Directory](https://github.com/APIs-guru/openapi-directory)
   and read the current contribution instructions and automated validation rules.
4. Search the directory for `The Neural Ledger` and the API domain. If an entry
   exists, update it instead of creating a duplicate.
5. Fork the repository under `bekirdag`, create a submission branch, and add the
   TNL definition or source URL in the exact current directory format.
6. Run the directory's validation commands locally and correct the canonical TNL
   schema rather than maintaining an APIs.guru-only fork where possible.
7. Open a pull request. Include the official website, documentation, source
   repository, support contact, license, and evidence that the API owner is making
   the submission.
8. Address review feedback, wait for merge and directory generation, then verify
   the generated listing and downloadable schema.

### 14. Publish Verified n8n Community Nodes

**Accounts:** use GitHub `bekirdag`, the TNL npm organization, and a separate n8n
Creator Portal account. No Microsoft or Google account is required.

Build this in a dedicated repository such as `tnl-n8n-nodes`, because n8n's
scaffold, versioning, provenance workflow, and review lifecycle are independent
from the core SDK monorepo.

1. Open [n8n Creator Portal registration](https://creators.n8n.io/register).
   Create an account with a TNL-controlled email, verify it, enable available
   account security, and store recovery information.
2. Create a public GitHub repository under `bekirdag` or a future TNL GitHub
   organization. Make the ownership and support path explicit.
3. Scaffold with the current n8n tool:

   ```bash
   npm create @n8n/node
   ```

4. Name the package `n8n-nodes-tnl` or a compliant scoped equivalent. Include the
   `n8n-community-node-package` keyword and the required `n8n` package metadata.
5. Implement credentials plus the agreed trigger/actions. The first verified
   version should use the stable TNL API and webhook contracts rather than
   private endpoints.
6. Do not add runtime dependencies: current verified-community-node rules forbid
   them. Use the n8n request helpers and generated scaffold patterns.
7. Run `npm run lint`, `npm run dev`, unit tests, and a live workflow test for
   every trigger/action. Document authentication and example workflows.
8. Keep the scaffolded `.github/workflows/publish.yml`. Confirm the project uses
   `@n8n/node-cli` version `0.23.0` or later.
9. Bootstrap the npm package if necessary, then open its npm **Settings** >
   **Trusted Publishers** > **Add a publisher** and configure:

   | Field             | Value                                 |
   | ----------------- | ------------------------------------- |
   | Provider          | GitHub Actions                        |
   | Repository owner  | `bekirdag` or the actual GitHub owner |
   | Repository name   | `tnl-n8n-nodes` or the actual repo    |
   | Workflow filename | `publish.yml`                         |
   | Allowed action    | `npm publish`                         |

10. Run `npm run release` according to the generated project instructions. Push
    the version commit and tag so GitHub Actions publishes with provenance.
11. Open the npm package page and verify version, README, provenance, repository,
    license, keywords, node metadata, and absence of runtime dependencies.
12. Sign in to the [n8n Creator Portal](https://creators.n8n.io/login), select
    node submission/verification, enter the npm package and repository, and
    complete the technical, UX, documentation, and ownership fields.
13. Submit for verification. n8n will fetch the npm artifact, so never replace or
    force-mutate the published version while review is in progress.
14. After approval, install the node from n8n's node panel in a clean instance,
    authenticate with a bounded key, and run each visible trigger/action.

As of 2026-07-18, n8n requires GitHub Actions provenance for verified submissions
and does not accept direct local publication for that review path. Reference:
[n8n community-node publication](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/).

### 15. Publish Pipedream Components

**Accounts:** a free Pipedream account and GitHub account are required. Use
GitHub `bekirdag`; create Pipedream with a TNL-controlled email. Google or
Microsoft accounts are not required.

1. Open [Pipedream sign-up](https://pipedream.com/auth/signup), create the
   TNL-owned account, verify its email, and create/select a TNL workspace.
2. Install Pipedream's current CLI from its official instructions, then connect
   the terminal:

   ```bash
   pd login
   ```

3. Search Pipedream for a `The Neural Ledger` app. If it does not exist, use
   Pipedream's app-integration request path first; public components need the
   corresponding app directory.
4. Develop a private action and source in the TNL account. Start with story search,
   story detail, cited brief, and a new-or-revised-story webhook source.
5. Use a Pipedream managed app credential for `TNL_API_KEY`. Do not expose it as
   an ordinary string prop or log it.
6. Deploy privately with the current `pd` development commands and test live
   events, deduplication, first-run behavior, retries, pagination, rate limits,
   and invalid credentials.
7. Fork [PipedreamHQ/pipedream](https://github.com/PipedreamHQ/pipedream) under
   `bekirdag` and clone the fork outside this repository.
8. Add or update the TNL app under `components/tnl` using the current registry
   structure. Add app authentication, actions, sources, README files, static
   sample events, and semantic component versions.
9. Install the registry dependencies and run its current lint/test commands for
   `components/tnl`. Follow the repository instructions if they differ from old
   examples.
10. Push the branch and open a pull request to Pipedream's registry. Describe the
    user workflows, API ownership, authentication, event behavior, tests, support,
    and source-attribution handling.
11. Address review feedback. After merge, wait for registry publication and find
    The Neural Ledger in Pipedream's workflow builder.
12. Connect a fresh TNL account and execute every public action/source before
    adding the Pipedream listing to TNL documentation.

Reference: [Pipedream Registry contribution process](https://pipedream.com/docs/components/contributing)
and [component guidelines](https://pipedream.com/docs/components/contributing/guidelines).

### 16. Publish a Zapier Integration After Webhooks Are Stable

**Account:** create or use a Zapier developer account with a company-domain
email. Zapier publication does not inherently require a Google or Microsoft
identity.

1. Open [Zapier Developer Platform](https://developer.zapier.com/). Select
   **Sign Up** if TNL does not already have an owner account; use the TNL company
   email, verify it, and enable account security.
2. Add another company-domain team member as an admin before public review. Zapier
   expects the integration to be owned by the API provider rather than an
   unrelated consultant account.
3. Select **Start a Zapier Integration**. Use `The Neural Ledger` as the public
   app name and choose the Platform UI or CLI. Prefer the CLI if the integration
   will be maintained in Git and tested in CI.
4. Implement API-key authentication, a new-or-revised-story webhook trigger,
   story search, story detail, related stories, entity/asset resolution, and a
   cited-brief action.
5. Add branding, category, descriptions, field help, dynamic dropdowns, sample
   data, source URLs, privacy policy, terms, and support documentation.
6. Create a non-expiring review account for `integration-testing@zapier.com` or
   the exact address Zapier shows in the current review form. Give it the features
   needed for all tests and make sure login does not require reviewer access to
   email, SMS, or MFA.
7. Run every trigger, search, and action successfully in the Zap editor. Add CLI
   tests where applicable and verify webhook subscribe, delivery, deduplication,
   unsubscribe, retry, and replay behavior.
8. Invite at least three independent users and have them run live Zaps. Current
   public requirements include live usage and at least one successful live Zap
   for every visible component; check the validation screen for the exact current
   counts.
9. Open the integration in the Developer Platform, select **Integration Home** >
   **Publish**, complete every automated check, and fix failures before requesting
   review.
10. Complete the publishing form with ownership, support, review credentials,
    marketing copy, documentation, privacy, terms, and test instructions. Select
    **Submit for Review**.
11. Address reviewer feedback and keep the review account active. After approval,
    complete Zapier's beta period and monitor failures, support, active users, and
    component adoption.
12. Verify the public App Directory listing and every template from a new Zapier
    account before promoting it.

Reference: [Zapier public integration process](https://docs.zapier.com/integrations/publish/public-integration)
and [publishing requirements](https://docs.zapier.com/integrations/publish/integration-publishing-requirements).

### Deferred Accounts: Create Only When the Product Exists

Do not create these accounts during the first launch wave. Use this table as the
activation checklist when the corresponding artifact passes its readiness gate.

| Deferred platform              | When to activate                                                    | Exact account decision and starting point                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rich VS Code extension         | Timeline/evidence panel or other editor-native UI is tested         | A Microsoft account is required. Sign in at [Visual Studio Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/), create or select an Azure DevOps organization and publisher, install `@vscode/vsce`, package with `vsce package`, then publish through the portal or current workload-identity automation. The MCP gallery does not need this account. |
| Open VSX                       | The VS Code extension is stable                                     | Create an Eclipse Foundation account and claim the publisher namespace at [Open VSX](https://open-vsx.org/). Create a scoped publishing token only when CI is ready; publish the same tested VSIX-compatible build and verify it in VSCodium.                                                                                                                                                 |
| Make Apps Marketplace          | n8n/Pipedream usage proves the trigger/action contract              | Create a TNL-owned [Make](https://www.make.com/en/register) account and organization, build and test a custom app, create its invitation link and landing page, then follow [Make's marketplace submission](https://developers.make.com/custom-apps-documentation/apps-marketplace/how-does-it-work).                                                                                         |
| Anthropic Connectors Directory | Remote MCP OAuth, support, privacy, and reliability are ready       | Use or create a company-owned Anthropic/Claude account, then follow the current [connectors directory submission](https://support.anthropic.com/en/articles/11596036-anthropic-connectors-directory-faq). Do not create the account for a local-only server.                                                                                                                                  |
| Microsoft 365 Copilot          | Enterprise remote connector and Microsoft review package exist      | A Microsoft work account, Entra tenant, and Microsoft 365 developer/admin access are required. Start with [federated connector submission](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/submit-federated-connector), not a personal Microsoft account.                                                                                                                  |
| Chrome Web Store               | The browser side panel is complete and privacy-reviewed             | Create a Google account owned by TNL, enroll it as a Chrome Web Store developer, pay any current one-time registration fee, complete identity verification, upload the signed package, fill privacy/data-use disclosures, and submit for review through the [Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole/).                                                     |
| Google Workspace Marketplace   | The Sheets add-on and OAuth scopes are stable                       | A Google Workspace/Cloud account is required. Create the Google Cloud project under TNL's organization, configure OAuth consent and verification, then publish through the [Google Workspace Marketplace SDK](https://developers.google.com/workspace/marketplace/how-to-publish).                                                                                                            |
| QuantConnect                   | Point-in-time history, mappings, licensing, and delivery pass QA    | Create a TNL vendor account through [QuantConnect dataset vendors](https://www.quantconnect.com/docs/v2/cloud-platform/datasets/vendors) and begin review only with a maintained LEAN integration and sample history.                                                                                                                                                                         |
| Enterprise data marketplaces   | Legal terms, redistribution rights, SLA, support, and billing exist | Create provider accounts under the company legal entity for Snowflake, Databricks, and AWS. Do not use personal cloud accounts or start review before regional delivery and licensing are settled.                                                                                                                                                                                            |

#### Rich VS Code extension publication sequence

When the extension readiness gate is met, use this exact ownership sequence:

1. Open [Microsoft account creation](https://signup.live.com/) only if TNL has no
   suitable company-controlled Microsoft identity. If TNL has a Microsoft 365
   work account, use that instead of creating a personal Outlook address.
2. Sign in to [Azure DevOps](https://dev.azure.com/) and create or select the TNL
   organization.
3. Open [Visual Studio Marketplace publisher management](https://marketplace.visualstudio.com/manage/publishers/),
   select **Create publisher**, reserve a stable publisher ID such as
   `theneuralledger`, enter the public display name and support information, and
   save.
4. Put the exact publisher ID in the extension's `package.json`. Extension name
   and publisher IDs become public, durable identifiers; review them before the
   first publication.
5. Install and validate the publisher CLI:

   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```

6. Inspect the generated VSIX for source maps, credentials, internal URLs,
   oversized assets, license, README, changelog, icon, and minimum VS Code version.
7. For an initial manual release, follow the current Marketplace authentication
   instructions and upload the VSIX from publisher management or run
   `vsce publish`. Prefer Microsoft Entra workload identity for durable CI rather
   than creating a long-lived personal token.
8. Install the public extension from the Marketplace in stable VS Code on macOS,
   Windows, and Linux. Test activation, authentication, MCP connection, UI,
   uninstall, and upgrade.
9. Publish the same tested build to Open VSX only after Marketplace validation.

Reference: [official VS Code extension publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

### Publication Evidence Checklist

For every channel, attach these items to the release issue or internal release
log before marking publication complete:

1. Owner account and organization/workspace name, without passwords or secrets.
2. Public package, listing, or pull-request URL.
3. Source commit and released semantic version.
4. CI workflow run, provenance, signature, or marketplace review reference.
5. Signed-out listing screenshot or captured page URL.
6. Clean-account install evidence and one successful end-to-end operation.
7. Negative test for missing/invalid authentication.
8. Support, privacy, terms, repository, and documentation link checks.
9. Next renewal, token rotation, ownership review, or re-verification date.
10. Rollback, unpublish, or disable procedure for that channel.

## Recommended Build and Launch Order

### Days 0-30

1. Publish npm, PyPI, and container artifacts using the existing release runbook.
2. Publish to the official MCP Registry and add the VS Code install link.
3. Create the Postman public workspace and API explorer.
4. Ship the remote MCP gateway authentication and operations baseline.
5. Submit the working server to Docker, Smithery, Glama, and PulseMCP.
6. Publish four end-to-end examples: AI research, news monitoring automation,
   Python event study, and weekly cited briefing.

### Days 31-60

1. Ship signed webhooks and event subscriptions.
2. Release n8n nodes and Pipedream components.
3. Release the Cursor plugin and shared research skill pack.
4. Build the MCP Apps visual components and submit the ChatGPT/Codex plugin.
5. Release the first quant toolkit features and notebook templates.

### Days 61-90

1. Submit the remote connector to Anthropic and Microsoft after the OAuth,
   privacy, support, and reliability gates pass.
2. Publish the Zapier integration using production webhook triggers.
3. Build the browser extension and either Raycast or Google Sheets based on
   observed audience demand.
4. Begin QuantConnect integration only if the point-in-time history and mappings
   meet marketplace requirements.
5. Start dlt/Airbyte connectors when at least one design partner needs warehouse
   synchronization.

## Marketplace Submission Package

Maintain one reusable submission kit so every listing is accurate and consistent:

- One-sentence and long product descriptions.
- Square and wide brand assets.
- Public documentation and five-minute quick start.
- Demo video or animated workflow capture.
- Sample key or sample dataset.
- Canonical OpenAPI file and MCP `server.json`.
- Tool, resource, and prompt descriptions with representative outputs.
- Privacy policy, terms, acceptable-use policy, security contact, and support URL.
- Authentication and account-deletion instructions.
- Uptime/status page, rate limits, quotas, and data-retention statement.
- Source attribution and content-licensing explanation.
- Changelog, semantic versions, compatibility matrix, and deprecation policy.

## Discovery Content That Supports Every Channel

Marketplace listings convert better when the public documentation answers a
specific job. Create durable pages and examples for:

1. Building a cited AI news-research agent with MCP.
2. Monitoring material developments for a company, asset, region, or theme.
3. Creating a point-in-time event dataset without look-ahead bias.
4. Producing a weekly consequential-developments briefing.
5. Comparing coverage and source evidence across related stories.
6. Sending high-impact alerts through n8n, Zapier, or Pipedream.
7. Loading TNL into pandas, Polars, DuckDB, a warehouse, and QuantConnect.

Each page should include runnable code, expected output, source citations, API
limits, and links to the relevant package and marketplace listing. Use canonical
URLs and keep package descriptions, repository topics, and developer-site
terminology aligned so search engines associate TNL with the same use cases.

## Metrics

Measure reach by completed value, not listing count:

- Package views, installs, and install-to-first-success rate.
- API keys created from each marketplace or documentation campaign.
- Remote MCP account links, active users, tool calls, and cited answers produced.
- Webhook subscriptions, successful deliveries, and workflows active after 30 days.
- Notebook runs, template uses, and example-to-key conversion.
- Weekly retained developers and organizations.
- Marketplace search impressions, listing views, installs, and activation.
- Support load, error rate, latency, and cost per active integration.

Add referral parameters or marketplace-specific onboarding codes without putting
secrets in package metadata. Record the source at account creation so TNL can stop
maintaining channels that create installs but no continuing use.

## Do Not Build Yet

- Separate LangChain, LlamaIndex, CrewAI, or AutoGen packages. Publish small MCP
  recipes first; add a native wrapper only after sustained demand demonstrates a
  capability MCP cannot provide.
- A VS Code extension that only edits MCP configuration. The registry and
  `vscode:mcp/install` already handle that job.
- Multiple thin IDE extensions before the remote MCP and shared UI components are
  stable.
- A RapidAPI listing before TNL decides whether separate marketplace billing,
  authentication, quotas, and support are worth the operational split.
- Full-corpus dataset uploads to Hugging Face or similar platforms without
  explicit source-content licensing and redistribution rights.
- Broker integrations, trading execution, or automated trade recommendations.
- Widgets or feed republishers that duplicate complete TNL stories and dilute the
  canonical article URLs.

## Account and Owner Actions

The first launch wave requires owner-controlled accounts or approvals for:

1. npm and PyPI publication.
2. Official MCP Registry namespace authentication.
3. Docker MCP Catalog, Smithery, Glama, and PulseMCP submissions.
4. A Postman public workspace.
5. OAuth client registration and public legal/support URLs for the remote MCP.
6. Cursor and ChatGPT/Codex plugin submissions.

Accounts for Zapier, Anthropic, Microsoft, Chrome, Google Workspace, QuantConnect,
and enterprise data marketplaces are not needed until the corresponding build is
ready for review. Do not create all accounts in advance; each unused listing adds
security, support, and maintenance obligations.

## Decision Summary

The highest-return path is not another generic SDK. It is:

1. Publish and list the packages that already exist.
2. Make TNL available through one secure hosted MCP endpoint.
3. Add a reliable event/webhook layer for automation.
4. Package differentiated TNL research workflows and visual evidence views.
5. Add quant-ready point-in-time data handling.
6. Expand into extensions and enterprise data marketplaces only after activation
   data proves the audience is present.
