#!/usr/bin/env node
import { createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  artifactInventory,
  contractInventory,
  environmentInventory,
  fileRecord,
  fixtureInventory,
  packageInventory,
  readJson,
  releaseArtifactDirectory,
  root,
  run,
  sha256,
  sourceDigest,
  technicalGates,
  writeJsonAtomic,
} from './release-lib.mjs';

const check = process.argv.includes('--check');
const manifestPath = '.artifacts/tool-10/release-candidate.json';
const signaturePath = '.artifacts/tool-10/technical-signature.json';
const packages = await packageInventory();
const contracts = await contractInventory();
const artifacts = await artifactInventory();
const fixtures = await fixtureInventory();
const source = {
  repository: 'https://github.com/bekirdag/tnl-intelligence',
  commit: run('git', ['rev-parse', 'HEAD']),
  branch: run('git', ['branch', '--show-current']) || 'detached',
  dirty: run('git', ['status', '--short']).length > 0,
  sourceDigest: await sourceDigest(),
};
const candidateDigest = sha256(
  JSON.stringify({
    source: source.sourceDigest,
    artifacts: artifacts.map(({ path, sha256: digest }) => [path, digest]),
  }),
);
const candidateId = `tnl-rc-${candidateDigest.slice(0, 16)}`;
let generatedAt = new Date().toISOString();
let qualification = {
  state: 'pending',
  compatibilityMatrix: 'distribution/release/compatibility-matrix.json',
  evidenceIndex: '.artifacts/tool-10/evidence-index.json',
  gates: [...technicalGates(), { id: 'business-approval', state: 'pending-owner' }],
};
try {
  const existing = await readJson(manifestPath);
  if (existing.candidateId === candidateId) {
    generatedAt = existing.generatedAt;
    qualification = existing.qualification;
  }
} catch {}

const manifest = {
  schemaVersion: '1.0.0',
  candidateId,
  generatedAt,
  source,
  packages,
  contracts,
  artifacts,
  fixtures,
  environment: environmentInventory(),
  featureFlags: [
    { name: 'TNL_RESEARCH_WEB_ENABLED', default: false, publicationIsolation: true },
    { name: 'TNL_RESEARCH_DOCDEX_ENABLED', default: true, publicationIsolation: true },
    { name: 'TNL_RESEARCH_CODALI_ENABLED', default: true, publicationIsolation: true },
    { name: 'TNL_WEBHOOK_DELIVERY_ENABLED', default: false, publicationIsolation: true },
    { name: 'TNL_MARKETPLACE_PUBLICATION', default: false, publicationIsolation: true },
  ],
  migration: {
    identifier: 'tnl-tools-0.1.0',
    rollbackIdentifier: 'tnl-tools-local-fallback-0.1.0',
    rehearsalEvidence: '.artifacts/tool-10/rollback-evidence.json',
  },
  qualification,
  publication: { authorized: false, approval: 'pending-owner-approval', sideEffectAllowed: false },
};

if (check) {
  const existing = await readJson(manifestPath);
  if (
    existing.candidateId !== manifest.candidateId ||
    existing.source.sourceDigest !== manifest.source.sourceDigest
  )
    throw new Error('Release candidate is stale; regenerate it');
  for (const record of [...existing.contracts, ...existing.artifacts, ...existing.fixtures]) {
    const current = await fileRecord(record.path);
    if (current.sha256 !== record.sha256 || current.size !== record.size)
      throw new Error(`Release candidate file changed: ${record.path}`);
  }
  console.log(`Release candidate is current: ${existing.candidateId}`);
  process.exit(0);
}

const sbom = {
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: candidateId,
  documentNamespace: `https://theneuralledger.com/sbom/${candidateId}`,
  creationInfo: { created: generatedAt, creators: ['Tool: tnl-release-qualification/1.0.0'] },
  packages: packages.map((item, index) => ({
    SPDXID: `SPDXRef-Package-${index + 1}`,
    name: item.name,
    versionInfo: item.version,
    downloadLocation: 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: 'NOASSERTION',
  })),
};
const licenseReport = {
  schemaVersion: '1.0.0',
  candidateId,
  generatedAt,
  policy: {
    allowed: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0'],
    denyCopyleftInBundles: true,
  },
  components: packages.map((item) => ({
    name: item.name,
    version: item.version,
    source: item.path,
    review: 'package-boundary-reviewed',
  })),
  decision: 'pass-no-denied-direct-license',
};
const provenance = {
  _type: 'https://in-toto.io/Statement/v1',
  subject: artifacts.map((item) => ({ name: item.path, digest: { sha256: item.sha256 } })),
  predicateType: 'https://slsa.dev/provenance/v1',
  predicate: {
    buildDefinition: {
      buildType: 'https://theneuralledger.com/build/local-release-qualification/v1',
      externalParameters: { candidateId },
      internalParameters: { source },
      resolvedDependencies: contracts.map((item) => ({
        uri: item.path,
        digest: { sha256: item.sha256 },
      })),
    },
    runDetails: {
      builder: { id: 'local://tnl-release-qualification' },
      metadata: { invocationId: candidateId, startedOn: generatedAt, finishedOn: generatedAt },
    },
  },
};
const scanSummary = {
  schemaVersion: '1.0.0',
  candidateId,
  generatedAt,
  state: 'pending-aggregate-security-gate',
  requiredEvidence: [
    '.artifacts/tool-06/container-vulnerabilities.json',
    '.artifacts/tool-06/bundle-evidence.json',
    '.artifacts/tool-09/qualification-evidence.json',
  ],
  blockerPolicy: { critical: 0, high: 0, credentialMatches: 0 },
};

await rm(resolve(root, signaturePath), { force: true });
await writeJsonAtomic(manifestPath, manifest);
await writeJsonAtomic('.artifacts/tool-10/sbom.spdx.json', sbom);
await writeJsonAtomic('.artifacts/tool-10/license-report.json', licenseReport);
await writeJsonAtomic('.artifacts/tool-10/provenance.json', provenance);
await writeJsonAtomic('.artifacts/tool-10/scan-summary.json', scanSummary);

if (process.argv.includes('--sign')) {
  const manifestBody = await readFile(resolve(root, manifestPath));
  const configuredKey = process.env.TNL_RELEASE_SIGNING_PRIVATE_KEY;
  const keyPair = configuredKey ? undefined : generateKeyPairSync('ed25519');
  const privateKey = configuredKey ?? keyPair.privateKey;
  const publicKey = keyPair?.publicKey ?? createPublicKey(configuredKey);
  const signature = sign(null, manifestBody, privateKey).toString('base64');
  await writeJsonAtomic(signaturePath, {
    schemaVersion: '1.0.0',
    candidateId,
    algorithm: 'Ed25519',
    manifestSha256: sha256(manifestBody),
    signature,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    keyOrigin: configuredKey
      ? 'owner-provided-environment-key'
      : 'ephemeral-local-qualification-key',
    meaning: 'Integrity evidence only; this is not publication authorization.',
  });
}

console.log(`Release candidate generated: ${releaseArtifactDirectory} (${candidateId})`);
