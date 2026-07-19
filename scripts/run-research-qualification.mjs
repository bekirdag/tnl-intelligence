import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const artifactDirectory = resolve(root, '.artifacts/tool-05');
const temporary = await mkdtemp(join(tmpdir(), 'tnl-tool-05-'));
const evidence = {
  tool: '05-research-skills-app',
  generatedAt: new Date().toISOString(),
  stages: [],
};
let stageNumber = 0;

try {
  await rm(artifactDirectory, { recursive: true, force: true });
  await mkdir(artifactDirectory, { recursive: true, mode: 0o700 });

  await stage(
    'verify generated research contracts, build, and run deterministic evaluations',
    async () => {
      run('npm', ['run', 'research:check']);
      run('npm', ['run', 'build', '--workspace', '@theneuralledger/research']);
      run('npm', ['run', 'test', '--workspace', '@theneuralledger/research']);
      run('npm', ['run', 'test:research:security']);
    },
  );

  await stage('build and verify MCP research tools and App resource', async () => {
    run('npm', ['run', 'build', '--workspace', '@theneuralledger/mcp']);
    run('npm', ['run', 'test', '--workspace', '@theneuralledger/mcp']);
    run('npm', ['run', 'test', '--workspace', '@theneuralledger/gateway']);
  });

  await stage('exercise standalone workspace at desktop and mobile viewports', async () => {
    run('node', ['test/browser/research.browser.mjs']);
  });

  await stage('pack and execute clean research and MCP consumers', async () => {
    const sdk = await pack('@theneuralledger/sdk');
    const research = await pack('@theneuralledger/research');
    const mcp = await pack('@theneuralledger/mcp');
    const consumer = join(temporary, 'consumer');
    await mkdir(consumer, { recursive: true });
    await writeFile(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
    run(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', sdk, research, mcp],
      consumer,
    );
    await writeFile(
      join(consumer, 'verify.mjs'),
      `import { listResearchSkills, createDemoResearchTask, ResearchOrchestrator, DeterministicEvidenceAdapter, DeterministicCodaliAdapter, DETERMINISTIC_RESEARCH_EVIDENCE } from '@theneuralledger/research';
import { TNL_RESEARCH_TOOL_NAMES } from '@theneuralledger/mcp';
if (listResearchSkills().length !== 6 || TNL_RESEARCH_TOOL_NAMES.length !== 6) throw new Error('missing research capabilities');
const orchestrator=new ResearchOrchestrator({adapters:['tnl','docdex','web'].map(tool=>new DeterministicEvidenceAdapter(tool,DETERMINISTIC_RESEARCH_EVIDENCE)),codali:new DeterministicCodaliAdapter(),now:()=>new Date('2026-07-18T12:00:00.000Z')});
const result=await orchestrator.run({tenantId:'clean',actorId:'clean'},createDemoResearchTask());
if(result.completionReason!=='complete'||result.automatedAuthor.name!=='TNL Bot')throw new Error('clean research run failed');
console.log(result.resultId);\n`,
    );
    const output = run('node', ['verify.mjs'], consumer).stdout;
    if (!output.includes('res_'))
      throw new Error('clean research consumer did not return a result');
  });

  await stage('prove local entrypoint fails closed and scan public artifacts', async () => {
    const startup = spawnSync('node', ['packages/research/dist/service-bin.js'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', TNL_RESEARCH_DEV_SERVICE: '1' },
    });
    if (
      startup.status === 0 ||
      !`${startup.stdout}${startup.stderr}`.includes('cannot start in production')
    )
      throw new Error('research development entrypoint did not fail closed in production');
    const scan = [
      await readFile(resolve(root, 'packages/research/README.md'), 'utf8'),
      await readFile(resolve(root, 'packages/research/public/app.js'), 'utf8'),
      await readFile(resolve(root, 'test/fixtures/research/evaluations-v1.json'), 'utf8'),
    ].join('\n');
    if (
      /tnl_(?:live|prod)_[A-Za-z0-9_-]+|(?:api[_ -]?key|bearer|secret)\s*[:=]\s*[A-Za-z0-9_-]{16,}/i.test(
        scan,
      )
    )
      throw new Error('secret-like credential found in research assets');
  });

  const evidencePath = join(artifactDirectory, 'evidence.json');
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  await chmod(evidencePath, 0o600);
  console.log(`Tool 05 qualification passed: ${evidencePath}`);
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

async function pack(workspace) {
  const packed = JSON.parse(
    run('npm', [
      'pack',
      '--json',
      '--workspace',
      workspace,
      '--pack-destination',
      artifactDirectory,
    ]).stdout,
  );
  const filename = packed[0]?.filename;
  if (!filename) throw new Error(`npm pack did not return a filename for ${workspace}`);
  return join(artifactDirectory, filename);
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    env: { ...process.env },
  });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  return result;
}
