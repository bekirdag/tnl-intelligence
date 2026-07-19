import assert from 'node:assert/strict';
import test from 'node:test';
import { readJson } from '../../scripts/release-lib.mjs';

test('quant reference workload remains inside release thresholds', async () => {
  const benchmark = await readJson('.artifacts/tool-09/benchmark.json');
  assert.equal(benchmark.rows, 5000);
  assert.ok(benchmark.ingestSeconds < 10, JSON.stringify(benchmark));
  assert.ok(benchmark.snapshotSeconds < 5, JSON.stringify(benchmark));
  assert.ok(benchmark.featureSeconds < 1, JSON.stringify(benchmark));
  assert.ok(benchmark.peakMemoryMiB < 256, JSON.stringify(benchmark));
});

test('load and research evidence records completed stages', async () => {
  const webhook = await readJson('.artifacts/tool-04/evidence.json');
  const research = await readJson('.artifacts/tool-05/evidence.json');
  assert.ok(webhook.stages.every(({ result }) => result === 'pass'));
  assert.ok(research.stages.every(({ result }) => result === 'pass'));
  assert.ok(research.stages.every(({ durationMs }) => durationMs < 60_000));
});

test('baseline, peak, burst, soak, fairness, retry-storm, and research thresholds pass', async () => {
  const evidence = await readJson('.artifacts/tool-10/capacity-chaos-evidence.json');
  assert.equal(evidence.state, 'pass');
  assert.deepEqual(
    evidence.profiles.map(({ id }) => id),
    ['baseline', 'expected-peak', 'burst', 'soak'],
  );
  assert.ok(
    evidence.profiles.every(
      ({ state, durationMs }) =>
        state === 'pass' && durationMs < evidence.thresholds.profileDurationMs,
    ),
  );
  const retry = evidence.chaos.find(({ id }) => id === 'webhook-retry-storm');
  assert.equal(retry.lostCommittedEvents, 0);
  const fairness = evidence.chaos.find(({ id }) => id === 'gateway-tenant-quota-fairness');
  assert.equal(fairness.allowedPerTenant, evidence.thresholds.allowedPerTenantPerMinute);
  const research = evidence.chaos.find(({ id }) => id === 'mixed-tenant-concurrent-research');
  assert.ok(research.durationMs < evidence.thresholds.researchDurationMs);
});
