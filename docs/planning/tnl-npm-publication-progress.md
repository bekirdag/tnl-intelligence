# TNL Intelligence npm Publication Progress

**Date:** 2026-07-20

**Status:** Complete

**Plan:** [TNL Intelligence npm Publication Plan](./tnl-npm-publication-plan.md)

## Current State

| Workstream                     | Status   | Evidence                                                     |
| ------------------------------ | -------- | ------------------------------------------------------------ |
| npm organization ownership     | Complete | `bekirdag` is owner of `theneuralledger`                     |
| Tagged artifact preflight      | Complete | Detached `v0.1.0` worktree built and passed `pack:check`     |
| SDK bootstrap publication      | Complete | Public `@theneuralledger/sdk@0.1.0`                          |
| Research bootstrap publication | Complete | Public `@theneuralledger/research@0.1.0`                     |
| MCP bootstrap publication      | Complete | Public `@theneuralledger/mcp@0.1.0`                          |
| CLI bootstrap publication      | Complete | Public `@theneuralledger/cli@0.1.0`                          |
| GitHub trusted publishers      | Complete | Four GitHub OIDC relationships allow `npm publish`           |
| Clean-consumer verification    | Complete | Anonymous install, imports, MCP discovery, and CLI help pass |

## Evidence

- `npm whoami` returned `bekirdag` on 2026-07-20.
- `npm org ls theneuralledger --json` returned `{"bekirdag":"owner"}`.
- The detached `v0.1.0` worktree passed the full TypeScript build, targeted SDK,
  Research, MCP, and CLI tests, and the seven-package tarball-content gate.
- Exact bootstrap tarball SHA-256 values:

  | Package                           | SHA-256                                                            |
  | --------------------------------- | ------------------------------------------------------------------ |
  | `@theneuralledger/sdk@0.1.0`      | `b7c2fe19f182734ebe190611b380859d4d74be559451ee0644cbf460b7fa95d0` |
  | `@theneuralledger/research@0.1.0` | `b5761012037ce038cca9bbf7bc1f2a8940e6597aae5c73f46b0d1fdb24e0c830` |
  | `@theneuralledger/mcp@0.1.0`      | `98236d172969116993694eb6af674f3226b39cdf4cbf50c316600f56e06894eb` |
  | `@theneuralledger/cli@0.1.0`      | `edef8edf0a6b38e274f13b1c577ae250e4a5177b82f600dae0bea5c9d27483b1` |

- Registry pages and shasums:

  | Package                                                                                              | npm shasum                                 |
  | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
  | [`@theneuralledger/sdk@0.1.0`](https://www.npmjs.com/package/@theneuralledger/sdk/v/0.1.0)           | `f97532325ee6bbfc884573007c3bcfbdddb7b5f5` |
  | [`@theneuralledger/research@0.1.0`](https://www.npmjs.com/package/@theneuralledger/research/v/0.1.0) | `402122c14e17cd8c9e8eefdeca1095c605580377` |
  | [`@theneuralledger/mcp@0.1.0`](https://www.npmjs.com/package/@theneuralledger/mcp/v/0.1.0)           | `02b4f22217e3186da4a5ef7df0517e29d7effbfa` |
  | [`@theneuralledger/cli@0.1.0`](https://www.npmjs.com/package/@theneuralledger/cli/v/0.1.0)           | `4c5968f777ba02f35ccbd83814cd02cb39d08db2` |

- GitHub environment `npm` exists with `bekirdag` as a required reviewer.
- npm OIDC trusted-publisher relationships target repository
  `bekirdag/tnl-intelligence`, workflow `release-npm.yml`, environment `npm`, and
  the `npm publish` action for all four packages.
- A clean consumer with no npm credentials installed all four pinned packages,
  reported zero production vulnerabilities, imported every public entry point,
  listed 14 MCP tools, and ran `tnl --help` successfully.
- Repository publication order and OIDC workflow are documented in
  [`../publishing.md`](../publishing.md) and `.github/workflows/release-npm.yml`.

## Blockers

None for publication. The one-time local bootstrap intentionally has no
provenance; the next GitHub OIDC release will generate provenance.

## Owner Security Follow-Up

For each package, open **Settings** > **Publishing access**, select **Require
two-factor authentication and disallow tokens**, and save. npm currently exposes
this maximum-security option in the package settings UI; the legacy `npm access
set mfa` command does not express the token-disallowing policy.
