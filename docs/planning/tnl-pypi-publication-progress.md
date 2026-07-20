# TNL Intelligence PyPI Publication Progress

**Date:** 2026-07-20

**Status:** In progress

**Plan:** [TNL Intelligence PyPI Publication Plan](./tnl-pypi-publication-plan.md)

## Current State

| Workstream                    | Status   | Evidence or next gate                                               |
| ----------------------------- | -------- | ------------------------------------------------------------------- |
| PyPI owner setup              | Complete | Owner reports verified email, 2FA, and pending publisher configured |
| GitHub `pypi` environment     | Complete | Protected environment requires review by `bekirdag`                 |
| Tagged artifact qualification | Complete | Python 3.13 checks and both artifacts pass                          |
| OIDC publication              | Pending  | Dispatch after artifact qualification                               |
| Public verification           | Pending  | Verify metadata, attestations, install, import, and CLI             |
| Evidence commit               | Pending  | Record immutable registry and workflow evidence                     |

## Evidence

- Repository package metadata declares `tnl-intelligence` version `0.1.0` and
  Python `>=3.10`.
- `.github/workflows/release-python.yml` uses environment `pypi`, grants
  `id-token: write`, validates the package, builds distributions, and invokes the
  official PyPA publish action without a stored token.
- The owner confirmed completion of the PyPI account and pending trusted
  publisher steps on 2026-07-20.
- PyPI returned `404` for `tnl-intelligence` immediately before publication.
- The Python package and release workflow have no changes between `v0.1.0` and
  `main`.
- GitHub environment `pypi` exists with `bekirdag` as a required reviewer and
  self-review permitted.
- Initial isolated Python 3.13 qualification passed Ruff and strict mypy but
  stopped during pytest collection because the release workflow installed
  `[dev]` without the optional quant engines imported by the quant tests.
- After installing quant engines, 39 of 40 tests passed; notebook execution
  exposed the second workflow dependency gap because no Python kernel was
  installed.
- `.github/workflows/release-python.yml` now installs
  `[dev,quant,notebooks]`; package source and distribution metadata remain
  unchanged from `v0.1.0`.
- Corrected qualification passed Ruff, formatting, strict mypy, and all 40
  pytest cases on Python 3.13.11, including optional engines and notebooks.
- `python -m build` produced exactly one wheel and one source distribution; both
  passed `twine check`.
- Qualified artifact SHA-256 values:

  | Artifact                                  | SHA-256                                                            |
  | ----------------------------------------- | ------------------------------------------------------------------ |
  | `tnl_intelligence-0.1.0-py3-none-any.whl` | `78c702026cc145936e8daa7b81e089b44d3eb5792ff4697890d6ee67c916e561` |
  | `tnl_intelligence-0.1.0.tar.gz`           | `2f37001ec9dca59a409f2d0a78f18276f0027b74fe6630c7847eae904ba0ed4b` |

- A fresh Python 3.13 environment installed the qualified wheel with
  `quant-cli`, passed `pip check`, imported `TnlClient`, `AsyncTnlClient`, and
  `verify_webhook`, and ran `tnl-quant --help` successfully.

## Blockers

None. The release workflow fix must be committed and pushed before dispatch.
