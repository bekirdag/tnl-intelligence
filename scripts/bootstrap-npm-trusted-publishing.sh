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
set -uo pipefail

cd "$(dirname "$0")/.."

REPO=bekirdag/tnl-intelligence
WORKFLOW=release-npm.yml
ENVIRONMENT=npm
NEW_PACKAGES=(events adapters connectors)
# mcp and cli are published but may not have a trusted publisher yet; listing
# them here makes the whole workspace token-free.
ALL_PACKAGES=(sdk research events adapters connectors mcp cli)

npm() { npx -y npm@11 "$@"; }

# Tracked explicitly: the retry above means set -e cannot abort on a failed
# publish, so without this the script would report success after failing.
failures=0

echo "==> Step 1: first publish of the new package names"
for pkg in "${NEW_PACKAGES[@]}"; do
  name="$(node -p "require('./packages/${pkg}/package.json').name")"
  version="$(node -p "require('./packages/${pkg}/package.json').version")"
  if npm view "${name}@${version}" version >/dev/null 2>&1; then
    echo "    ${name}@${version} already published, skipping"
    continue
  fi
  # A web login (npm login --auth-type=web) already satisfies 2FA, so try the
  # session first and only ask for a code if the registry actually demands one.
  if npm publish --workspace "${name}" --access public --provenance=false; then
    echo "    published ${name}@${version}"
    continue
  fi
  echo "    registry asked for a one-time password"
  read -r -p "    OTP for publishing ${name} (6 digits): " otp
  if npm publish --workspace "${name}" --access public --provenance=false --otp="${otp}"; then
    echo "    published ${name}@${version}"
  else
    echo "    FAILED to publish ${name}@${version}"
    failures=$((failures + 1))
  fi
done

echo
echo "==> Step 2: attach the release workflows as trusted publishers"
for pkg in "${ALL_PACKAGES[@]}"; do
  name="$(node -p "require('./packages/${pkg}/package.json').name")"
  if npm trust list "${name}" 2>/dev/null | grep -q "${WORKFLOW}"; then
    echo "    ${name} already trusts ${WORKFLOW}, skipping"
    continue
  fi
  echo "    configuring ${name}"
  if ! npm trust github "${name}" \
    --file "${WORKFLOW}" \
    --repo "${REPO}" \
    --env "${ENVIRONMENT}" \
    --allow-publish \
    -y; then
    echo "    FAILED to configure ${name}"
    failures=$((failures + 1))
  fi
done

# release-n8n.yml has no environment: gate, so no --env here.
if npm trust list n8n-nodes-tnl-intelligence 2>/dev/null | grep -q release-n8n.yml; then
  echo "    n8n-nodes-tnl-intelligence already trusts release-n8n.yml, skipping"
elif ! npm trust github n8n-nodes-tnl-intelligence \
  --file release-n8n.yml \
  --repo "${REPO}" \
  --allow-publish \
  -y; then
  echo "    FAILED to configure n8n-nodes-tnl-intelligence"
  failures=$((failures + 1))
fi

echo
if [ "${failures}" -gt 0 ]; then
  echo "${failures} step(s) failed. Nothing above should be treated as done."
  exit 1
fi
echo "Done. Every package now publishes from GitHub Actions over OIDC."
