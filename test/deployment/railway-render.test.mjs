import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const requiredVariables = [
  'TNL_GATEWAY_AUTHORIZATION_SERVERS',
  'TNL_GATEWAY_ISSUER',
  'TNL_GATEWAY_INTROSPECTION_URL',
  'TNL_GATEWAY_INTROSPECTION_CLIENT_ID',
  'TNL_GATEWAY_INTROSPECTION_CLIENT_SECRET',
  'TNL_GATEWAY_ACCESS_URL',
  'TNL_GATEWAY_CAPABILITY_URL',
  'TNL_GATEWAY_QUOTA_URL',
  'TNL_GATEWAY_DISABLE_URL',
  'TNL_GATEWAY_AUDIT_URL',
  'TNL_GATEWAY_IDP_HEALTH_URL',
  'TNL_GATEWAY_CONTROL_HEALTH_URL',
  'TNL_GATEWAY_SERVICE_TOKEN',
];

describe('Railway and Render deployment definitions', () => {
  it('uses the production gateway Dockerfile and readiness health check on Railway', async () => {
    const manifest = JSON.parse(await readFile('railway.json', 'utf8'));
    assert.equal(manifest.$schema, 'https://railway.com/railway.schema.json');
    assert.equal(manifest.build.builder, 'DOCKERFILE');
    assert.equal(manifest.build.dockerfilePath, 'Dockerfile.gateway');
    assert.equal(manifest.deploy.healthcheckPath, '/readyz');
    assert.equal(manifest.deploy.restartPolicyType, 'ON_FAILURE');
    assert.equal(JSON.stringify(manifest).includes('TNL_API_KEY'), false);
  });

  it('keeps Render credentials prompted and automatic redeployment disabled', async () => {
    const blueprint = await readFile('render.yaml', 'utf8');
    assert.match(blueprint, /dockerfilePath: \.\/Dockerfile\.gateway/);
    assert.match(blueprint, /healthCheckPath: \/readyz/);
    assert.match(blueprint, /autoDeployTrigger: off/);
    assert.match(blueprint, /plan: free/);
    assert.doesNotMatch(blueprint, /plan: (?:starter|standard|pro)/);
    assert.doesNotMatch(blueprint, /maxShutdownDelaySeconds/);
    assert.doesNotMatch(blueprint, /TNL_API_KEY/);
    for (const variable of requiredVariables) {
      assert.match(blueprint, new RegExp(`- key: ${variable}\\n\\s+sync: false`));
    }
  });

  it('contains no secret-looking literal values in either provider manifest', async () => {
    const manifests = `${await readFile('railway.json', 'utf8')}\n${await readFile('render.yaml', 'utf8')}`;
    assert.doesNotMatch(manifests, /tnl_(?:live|test)_key_/i);
    assert.doesNotMatch(manifests, /(?:client|workload|service)[_-]?secret\s*[:=]\s*[^\s]+/i);
    assert.doesNotMatch(manifests, /authorization:\s*Bearer/i);
  });
});
