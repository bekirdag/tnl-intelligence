import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const artifactDirectory = resolve(root, '.artifacts/tool-04');
const temporary = await mkdtemp(join(tmpdir(), 'tnl-tool-04-'));
const evidence = {
  tool: '04-webhook-event-delivery',
  generatedAt: new Date().toISOString(),
  stages: [],
};
let stageNumber = 0;

try {
  await rm(artifactDirectory, { recursive: true, force: true });
  await mkdir(artifactDirectory, { recursive: true, mode: 0o700 });

  await stage('build generated contracts and run TypeScript security/load suites', async () => {
    run('npm', ['run', 'webhooks:check']);
    run('npm', ['run', 'build', '--workspace', '@theneuralledger/events']);
    run('npm', ['run', 'test', '--workspace', '@theneuralledger/events']);
    run('npm', ['run', 'test:webhooks:security']);
    run('npm', ['run', 'test:webhooks:load']);
  });

  await stage('pack and execute a clean JavaScript webhook consumer', async () => {
    const packed = JSON.parse(
      run('npm', [
        'pack',
        '--json',
        '--workspace',
        '@theneuralledger/events',
        '--pack-destination',
        artifactDirectory,
      ]).stdout,
    );
    const filename = packed[0]?.filename;
    if (!filename) throw new Error('npm pack did not return an event package filename');
    const consumer = join(temporary, 'node-consumer');
    await mkdir(consumer, { recursive: true });
    await writeFile(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
    run(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(artifactDirectory, filename)],
      consumer,
    );
    await writeFile(
      join(consumer, 'verify.mjs'),
      `import { readFileSync } from 'node:fs';
import { validateWebhookEvent, verifyWebhook } from '@theneuralledger/events';
const corpus = JSON.parse(readFileSync(process.env.TNL_FIXTURE, 'utf8'));
if (validateWebhookEvent(corpus.event).length) throw new Error('invalid fixture');
const verified = await verifyWebhook({
  rawBody: corpus.rawBody,
  headers: corpus.headers,
  keys: { key_current123: Buffer.from(corpus.testKeyBase64url, 'base64url') },
  now: Number(corpus.headers['TNL-Webhook-Timestamp']),
});
console.log(verified.deliveryId);
`,
    );
    const result = run('node', ['verify.mjs'], consumer, {
      TNL_FIXTURE: resolve(root, 'test/fixtures/webhooks/signed-published-v1.json'),
    });
    if (!result.stdout.includes('dlv_abcdefghijklmnop'))
      throw new Error('clean JavaScript consumer did not verify the canonical delivery');
  });

  await stage('build a wheel and execute the same fixture in a clean Python consumer', async () => {
    const builder = resolve(root, '.venv/bin/python');
    if (!existsSync(builder)) throw new Error('repository .venv Python builder is missing');
    const dist = join(temporary, 'python-dist');
    await mkdir(dist, { recursive: true });
    run(builder, ['-m', 'build', '--outdir', dist, resolve(root, 'python/tnl_intelligence')]);
    const wheel = JSON.parse(
      run(builder, [
        '-c',
        'import json,pathlib,sys; print(json.dumps([str(p) for p in pathlib.Path(sys.argv[1]).glob("*.whl")]))',
        dist,
      ]).stdout,
    )[0];
    if (!wheel) throw new Error('Python wheel was not built');
    const environment = join(temporary, 'python-consumer');
    run('python3', ['-m', 'venv', environment]);
    const python = join(environment, 'bin/python');
    run(python, ['-m', 'pip', 'install', '--quiet', wheel]);
    const result = run(
      python,
      [
        '-c',
        `import base64,json,os
from tnl_intelligence import verify_webhook
corpus=json.load(open(os.environ['TNL_FIXTURE']))
key=base64.urlsafe_b64decode(corpus['testKeyBase64url']+'=')
verified=verify_webhook(corpus['rawBody'].encode(),corpus['headers'],{'key_current123':key},now=int(corpus['headers']['TNL-Webhook-Timestamp']))
print(verified.delivery_id)`,
      ],
      root,
      { TNL_FIXTURE: resolve(root, 'test/fixtures/webhooks/signed-published-v1.json') },
    );
    if (!result.stdout.includes('dlv_abcdefghijklmnop'))
      throw new Error('clean Python consumer did not verify the canonical delivery');
  });

  await stage('prove development entrypoints fail closed and scan artifacts', async () => {
    const service = spawnSync('node', ['packages/events/dist/service-bin.js'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', TNL_WEBHOOK_DEV_SERVICE: '1' },
    });
    if (service.status === 0 || !`${service.stderr}${service.stdout}`.includes('development-only'))
      throw new Error('webhook service did not reject production in-memory startup');
    const receiver = spawnSync('node', ['packages/events/dist/receiver-bin.js'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TNL_WEBHOOK_DEV_RECEIVER: '0' },
    });
    if (
      receiver.status === 0 ||
      !`${receiver.stderr}${receiver.stdout}`.includes('TNL_WEBHOOK_DEV_RECEIVER')
    )
      throw new Error('webhook receiver did not require its development flag');
    const scan = [
      await readFile(resolve(root, 'packages/events/README.md'), 'utf8'),
      await readFile(resolve(root, 'docs/webhook-operations.md'), 'utf8'),
      await readFile(resolve(root, 'test/fixtures/webhooks/signed-published-v1.json'), 'utf8'),
    ].join('\n');
    if (/tnl_(?:live|prod)_[A-Za-z0-9_-]+|TNL_API_KEY\s*=\s*[^.\s]/.test(scan))
      throw new Error('secret-like production credential found in webhook assets');
  });

  const evidencePath = join(artifactDirectory, 'evidence.json');
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  await chmod(evidencePath, 0o600);
  console.log(`Tool 04 qualification passed: ${evidencePath}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function stage(name, action) {
  stageNumber += 1;
  console.log(`${stageNumber}. Running: ${name}`);
  const startedAt = Date.now();
  await action();
  evidence.stages.push({ name, result: 'pass', durationMs: Date.now() - startedAt });
  console.log(`${stageNumber}. Complete: ${name}`);
}

function run(command, args, cwd = root, extraEnvironment = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, ...extraEnvironment },
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}
