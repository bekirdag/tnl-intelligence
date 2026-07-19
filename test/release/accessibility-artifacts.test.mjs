import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileRecord, readJson } from '../../scripts/release-lib.mjs';

const viewports = [
  ['.artifacts/tool-03/screenshots/desktop.png', 1440, 900],
  ['.artifacts/tool-03/screenshots/mobile.png', 390, 844],
  ['.artifacts/tool-05/research-desktop.png', 1440, 900],
  ['.artifacts/tool-05/research-tablet.png', 1024, 768],
  ['.artifacts/tool-05/research-narrow-panel.png', 480, 800],
  ['.artifacts/tool-05/research-mobile.png', 390, 844],
];

test('browser accessibility runs complete before the candidate is frozen', async () => {
  const preparation = await readJson('.artifacts/tool-10/artifact-preparation-evidence.json');
  const onboardingBrowser = preparation.commands.find(({ command }) =>
    command.endsWith('npm run test:onboarding:browser'),
  );
  assert.equal(onboardingBrowser?.state, 'pass');

  const research = await readJson('.artifacts/tool-05/evidence.json');
  const researchBrowser = research.stages.find(({ name }) =>
    name.includes('standalone workspace at desktop and mobile viewports'),
  );
  assert.equal(researchBrowser?.result, 'pass');
});

test('the frozen candidate contains valid screenshots for every required viewport', async () => {
  const candidate = await readJson('.artifacts/tool-10/release-candidate.json');
  const artifacts = new Map(candidate.artifacts.map((artifact) => [artifact.path, artifact]));

  for (const [path, width, minimumHeight] of viewports) {
    const frozen = artifacts.get(path);
    assert.ok(frozen, `${path} is missing from the candidate`);
    const current = await fileRecord(path);
    assert.equal(current.sha256, frozen.sha256, `${path} changed after candidate freeze`);
    assert.equal(current.size, frozen.size, `${path} size changed after candidate freeze`);

    const body = await readFile(path);
    assert.equal(body.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(body.readUInt32BE(16), width, `${path} width`);
    assert.ok(body.readUInt32BE(20) >= minimumHeight, `${path} height`);
  }
});
