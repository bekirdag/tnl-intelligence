# TNL Intelligence PyPI Publication Plan

**Plan date:** 2026-07-20

**Status:** In progress

**Progress:** [tnl-pypi-publication-progress.md](./tnl-pypi-publication-progress.md)

**Release:** `0.1.0`

**Project:** `tnl-intelligence`

## Objective

Publish the Python SDK and quant toolkit to PyPI from the qualified `v0.1.0`
source through GitHub Actions OIDC, then verify its public metadata,
attestations, dependency closure, command entry point, and clean installation.

## Authorization And Boundaries

- The owner confirmed that the verified, 2FA-protected PyPI account and pending
  GitHub trusted publisher are configured.
- The trusted publisher must match owner `bekirdag`, repository
  `tnl-intelligence`, workflow `release-python.yml`, and environment `pypi`.
- Publish only project `tnl-intelligence` version `0.1.0`.
- Never create or store a PyPI API token. Use the existing OIDC workflow.
- PyPI releases are immutable. Stop on a name/version conflict, publisher claim
  mismatch, unexpected artifact contents, or validation failure.

## Execution Order

1. Confirm the project version is not yet present on PyPI and the Git tag source
   is unchanged from the qualified release.
2. Create the protected GitHub environment `pypi` with `bekirdag` as required
   reviewer.
3. In an isolated `v0.1.0` worktree, install the package development dependencies
   and run Ruff, strict mypy, pytest, wheel/sdist build, metadata validation, and
   artifact inspection.
4. Record hashes for the qualified wheel and source distribution.
5. Dispatch `release-python.yml` from `main` with version `0.1.0`, approve the
   protected environment, and require the workflow to finish successfully.
6. Verify PyPI project metadata, uploaded files, hashes, Trusted Publisher
   attestations, and a clean anonymous install.
7. Import the SDK and run `tnl-quant --help` from the installed distribution.
8. Record evidence in the progress document and push the evidence commit.

## Validation Gates

- Package name and version match `python/tnl_intelligence/pyproject.toml`.
- `ruff check`, `ruff format --check`, strict `mypy`, and `pytest` pass.
- `python -m build` produces exactly one wheel and one source distribution.
- Both artifacts pass `twine check` and contain no secret or generated cache
  material.
- GitHub Actions uses `id-token: write`, environment `pypi`, and
  `pypa/gh-action-pypi-publish@release/v1` without a stored credential.
- PyPI reports version `0.1.0`, expected Python requirements, dependency
  metadata, verified repository URL, and publish attestations.
- A clean environment installs from PyPI and exercises the public import and CLI.

## Rollback

- Never replace or re-upload `0.1.0`.
- If the published release is defective, yank it and publish a qualified patch.
- If OIDC claims do not match, correct the pending publisher or GitHub environment
  before retrying; do not fall back to a long-lived token.

## Completion Criteria

- `tnl-intelligence==0.1.0` is public and installable from PyPI.
- Wheel, source distribution, metadata, and attestations match the qualified
  release.
- Clean SDK import and `tnl-quant --help` checks pass.
- Publication evidence is recorded and pushed to `main`.
