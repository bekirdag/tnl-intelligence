#!/usr/bin/env bash
# One-time bootstrap so the three new packages can move to OIDC.
#
# npm cannot attach a trusted publisher to a package that does not exist yet
# ("The package you're configuring must already exist on the npm registry"), so
# the first publish of a brand new name has to be authenticated another way.
# This uses interactive 2FA rather than a long-lived automation token: nothing
# durable is created, and every publish after this one goes through GitHub
# Actions over OIDC with no credential stored anywhere.
#
# Provenance is disabled for these first publishes because it requires a CI
# runner with an OIDC token. Subsequent versions get provenance from the
# workflow.
set -euo pipefail

cd "$(dirname "$0")/.."

REPO=bekirdag/tnl-intelligence
WORKFLOW=release-npm.yml
ENVIRONMENT=npm
NEW_PACKAGES=(events adapters connectors)
# mcp and cli are published but may not have a trusted publisher yet; listing
# them here makes the whole workspace token-free.
ALL_PACKAGES=(sdk research events adapters connectors mcp cli)

npm() { npx -y npm@11 "$@"; }

echo "==> Step 1: first publish of the new package names"
for pkg in "${NEW_PACKAGES[@]}"; do
  name="$(node -p "require('./packages/${pkg}/package.json').name")"
  version="$(node -p "require('./packages/${pkg}/package.json').version")"
  if npm view "${name}@${version}" version >/dev/null 2>&1; then
    echo "    ${name}@${version} already published, skipping"
    continue
  fi
  read -r -p "    OTP for publishing ${name}: " otp
  npm publish --workspace "${name}" --access public --provenance=false --otp="${otp}"
  echo "    published ${name}@${version}"
done

echo
echo "==> Step 2: attach this workflow as a trusted publisher"
for pkg in "${ALL_PACKAGES[@]}"; do
  name="$(node -p "require('./packages/${pkg}/package.json').name")"
  if npm trust list "${name}" 2>/dev/null | grep -q "${WORKFLOW}"; then
    echo "    ${name} already trusts ${WORKFLOW}, skipping"
    continue
  fi
  echo "    configuring ${name}"
  npm trust github "${name}" \
    --file "${WORKFLOW}" \
    --repo "${REPO}" \
    --env "${ENVIRONMENT}" \
    --allow-publish \
    -y
done

echo
echo "Done. Every package now publishes from GitHub Actions over OIDC."
echo "Next: the workflow's NODE_AUTH_TOKEN can be removed and the NPM_TOKEN"
echo "secret deleted."
