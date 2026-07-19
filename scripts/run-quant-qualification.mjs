import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packageRoot = resolve(root, 'python/tnl_intelligence');
const artifactRoot = resolve(root, '.artifacts/tool-09');
const temporary = await mkdtemp(join(tmpdir(), 'tnl-tool-09-'));
const configuredPython = process.env.TNL_QUANT_PYTHON;
const workspacePython = resolve(root, '.venv/bin/python');
const python = configuredPython ?? ((await exists(workspacePython)) ? workspacePython : 'python3');
const checks = [];

try {
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true, mode: 0o700 });
  await check(
    'generated-assets',
    python,
    [
      '-m',
      'tnl_intelligence.quant.asset_builder',
      '--output',
      'src/tnl_intelligence/quant/example_assets',
      '--check',
    ],
    packageRoot,
  );
  await check('ruff', python, ['-m', 'ruff', 'check', 'src', 'tests'], packageRoot);
  await check(
    'ruff-format',
    python,
    ['-m', 'ruff', 'format', '--check', 'src', 'tests'],
    packageRoot,
  );
  await check('strict-mypy', python, ['-m', 'mypy', 'src'], packageRoot);
  await check('python-tests', python, ['-m', 'pytest', '-q'], packageRoot);
  await check('quant-tests', python, ['-m', 'pytest', '-q', 'tests/quant'], packageRoot);

  const buildEnv = { ...process.env, SOURCE_DATE_EPOCH: '1784419200' };
  await check(
    'wheel-and-sdist',
    python,
    ['-m', 'build', '--outdir', artifactRoot],
    packageRoot,
    buildEnv,
  );
  const secondBuild = resolve(temporary, 'reproducible-build');
  await mkdir(secondBuild);
  await check(
    'reproducible-build',
    python,
    ['-m', 'build', '--outdir', secondBuild],
    packageRoot,
    buildEnv,
  );

  const artifacts = (await readdir(artifactRoot))
    .filter((name) => name.endsWith('.whl') || name.endsWith('.tar.gz'))
    .sort();
  if (artifacts.length !== 2) throw new Error(`expected wheel and sdist, got ${artifacts}`);
  const wheel = resolve(
    artifactRoot,
    artifacts.find((name) => name.endsWith('.whl')),
  );
  const sdist = resolve(
    artifactRoot,
    artifacts.find((name) => name.endsWith('.tar.gz')),
  );
  for (const name of artifacts) {
    const first = await digest(resolve(artifactRoot, name));
    const second = await digest(resolve(secondBuild, name));
    if (first !== second) throw new Error(`${name} is not reproducible`);
  }

  await cleanEnvironment('wheel-base', wheel, '', baseSmoke());
  await cleanEnvironment('sdist-base', sdist, '', baseSmoke());
  await cleanEnvironment('extra-arrow', wheel, 'quant-arrow', adapterSmoke('arrow'));
  await cleanEnvironment('extra-pandas', wheel, 'quant-pandas', adapterSmoke('pandas'));
  await cleanEnvironment('extra-polars', wheel, 'quant-polars', adapterSmoke('polars'));
  await cleanEnvironment('extra-duckdb', wheel, 'quant-duckdb', adapterSmoke('duckdb'));
  await cleanEnvironment('extra-cli', wheel, 'quant-cli', cliSmoke());
  await cleanEnvironment('extra-notebooks', wheel, 'notebooks', notebookSmoke());
  await cleanEnvironment('all-extras', wheel, 'quant,notebooks', allExtrasSmoke());

  await check('package-security-audit', python, ['-c', auditScript(), wheel, sdist]);
  const benchmarkOutput = run(
    python,
    [
      '-c',
      'import json; from tnl_intelligence.quant.benchmark import run_benchmark, assert_reference_bounds; r=run_benchmark(count=5000); assert_reference_bounds(r); print(json.dumps(r, sort_keys=True))',
    ],
    packageRoot,
    undefined,
    true,
  );
  const benchmark = JSON.parse(benchmarkOutput.trim().split('\n').at(-1));
  checks.push({ id: 'reference-benchmark', status: 'pass', rows: benchmark.rows });
  await writeFile(
    resolve(artifactRoot, 'benchmark.json'),
    `${JSON.stringify(benchmark, null, 2)}\n`,
    { mode: 0o600 },
  );

  const packageEvidence = await Promise.all(
    artifacts.map(async (filename) => ({
      filename,
      sha256: await digest(resolve(artifactRoot, filename)),
    })),
  );
  const evidence = {
    schemaVersion: '1.0',
    tool: '09-quantitative-research-toolkit',
    qualifiedAt: new Date().toISOString(),
    sourceRevision: revision(),
    runtime: { python: pythonVersion(), platform: process.platform, architecture: process.arch },
    checks,
    artifacts: packageEvidence,
    benchmark,
    supportedContract: {
      python: '>=3.10',
      optionalExtras: [
        'quant-arrow',
        'quant-pandas',
        'quant-polars',
        'quant-duckdb',
        'quant-cli',
        'notebooks',
        'quant',
      ],
      compatibility: 'current local versions plus Python 3.10-3.13 CI matrix in Tool 10',
    },
    automatedCoverage: [
      'point-in-time revision selection, retractions, late arrivals, dedupe, resume, and collisions',
      'look-ahead, outcome leakage, mapping validity, survivorship, split, and fill sentinels',
      'Arrow, pandas, Polars, Parquet, and DuckDB identity and timestamp preservation',
      'four notebooks from clean kernels and paired noninteractive examples',
      'isolated wheel/sdist base, per-extra, and all-extra installations',
      'reproducible artifacts and credential, private-path, cache, and restricted-content scans',
    ],
    externalOwnerGates: [{ id: 'pypi-publication', status: 'not-performed' }],
  };
  evidence.evidenceDigest = createHash('sha256')
    .update(JSON.stringify({ checks, artifacts: packageEvidence, benchmark }))
    .digest('hex');
  await writeFile(
    resolve(artifactRoot, 'qualification-evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`Tool 09 qualification passed (${evidence.evidenceDigest}).\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function check(id, command, args, cwd = root, env = undefined) {
  const started = Date.now();
  run(command, args, cwd, env);
  checks.push({ id, status: 'pass', durationMs: Date.now() - started });
}

async function cleanEnvironment(id, artifact, extra, smoke) {
  const started = Date.now();
  const environment = resolve(temporary, id);
  run(python, ['-m', 'venv', environment]);
  const isolatedPython = resolve(environment, 'bin/python');
  const requirement = extra ? `${artifact}[${extra}]` : artifact;
  run(isolatedPython, [
    '-m',
    'pip',
    'install',
    '--disable-pip-version-check',
    '--no-input',
    requirement,
  ]);
  run(isolatedPython, ['-m', 'pip', 'check']);
  run(isolatedPython, ['-c', smoke]);
  checks.push({ id, status: 'pass', durationMs: Date.now() - started });
  await rm(environment, { recursive: true, force: true });
}

function baseSmoke() {
  return `import sys
import tnl_intelligence
from tnl_intelligence.quant import IntelligenceObservation, LatencyPolicy
blocked = {'pandas', 'polars', 'pyarrow', 'duckdb', 'yaml', 'nbclient', 'nbformat'}
assert not blocked.intersection(sys.modules)
assert LatencyPolicy().retrieval_policy == 'historical'
assert tnl_intelligence.__version__ == '0.1.0'
print('base import passed')`;
}

function adapterSmoke(name) {
  const calls = {
    arrow:
      'from tnl_intelligence.quant.adapters import to_arrow; assert to_arrow(rows).num_rows == len(rows)',
    pandas:
      'from tnl_intelligence.quant.adapters import to_pandas; assert len(to_pandas(rows)) == len(rows)',
    polars:
      'from tnl_intelligence.quant.adapters import to_polars; assert to_polars(rows).height == len(rows)',
    duckdb:
      "from tnl_intelligence.quant.adapters import duckdb_connection; c=duckdb_connection(); assert c.execute('select 1').fetchone()[0] == 1; c.close()",
  };
  return `from tnl_intelligence.quant.sample import sample_observations
rows = sample_observations()
${calls[name]}
print('${name} extra passed')`;
}

function cliSmoke() {
  return `from tnl_intelligence.quant.cli import main
assert main(['sync', '--output', 'unused', '--dry-run']) == 0
print('CLI extra passed')`;
}

function notebookSmoke() {
  return `from importlib.resources import files
from tnl_intelligence.quant.notebook_runner import execute_notebooks
root = files('tnl_intelligence.quant.example_assets').joinpath('notebooks')
assert len(execute_notebooks(str(root))) == 4
print('notebook extra passed')`;
}

function allExtrasSmoke() {
  return `import tempfile
from importlib.resources import files
from pathlib import Path
from tnl_intelligence.quant.adapters import duckdb_connection, to_arrow, to_pandas, to_polars
from tnl_intelligence.quant.lake import RevisionLake
from tnl_intelligence.quant.notebook_runner import execute_notebooks
from tnl_intelligence.quant.sample import sample_observations
from tnl_intelligence.quant.storage import write_parquet
from tnl_intelligence.quant.temporal import parse_utc
rows = sample_observations()
with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    lake = RevisionLake(root / 'lake')
    lake.ingest(rows)
    snapshot = lake.snapshot(as_of=parse_utc('2026-06-08T00:00:00Z'), output=root / 'snapshot')
    parquet = write_parquet(snapshot.observations, root / 'snapshot.parquet')
    connection = duckdb_connection(parquet.path)
    assert connection.execute('select count(*) from tnl_observations').fetchone()[0] == len(snapshot.observations)
    connection.close()
assert to_arrow(rows).num_rows == len(rows)
assert len(to_pandas(rows)) == len(rows)
assert to_polars(rows).height == len(rows)
notebooks = files('tnl_intelligence.quant.example_assets').joinpath('notebooks')
assert len(execute_notebooks(str(notebooks))) == 4
print('all extras passed')`;
}

function auditScript() {
  return `import re, sys, tarfile, zipfile
for archive in sys.argv[1:]:
    if archive.endswith('.whl'):
        with zipfile.ZipFile(archive) as bundle:
            entries = [(name, bundle.read(name)) for name in bundle.namelist()]
    else:
        with tarfile.open(archive, 'r:gz') as bundle:
            entries = [(item.name, bundle.extractfile(item).read()) for item in bundle.getmembers() if item.isfile()]
    for name, content in entries:
        lowered = name.lower()
        assert '.venv/' not in lowered and '__pycache__' not in lowered and '.pyc' not in lowered, name
        text = content.decode('utf-8', errors='ignore')
        assert not re.search(r'/(Users|home)/[^/\\s]+/', text), name
        assert not re.search(r'Bearer\\s+[A-Za-z0-9._~-]{20,}', text), name
        assert not re.search(r'(?:sk|tnl)_[A-Za-z0-9_-]{24,}', text), name
        assert 'third-party article body fixture' not in text.lower(), name
print('package security audit passed')`;
}

function run(command, args, cwd = root, env = undefined, capture = false) {
  return execFileSync(command, args, {
    cwd,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: capture ? 'utf8' : undefined,
    env: { ...process.env, ...env, PIP_DISABLE_PIP_VERSION_CHECK: '1' },
    maxBuffer: 50 * 1024 * 1024,
  });
}

async function digest(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function revision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'uncommitted';
  }
}

function pythonVersion() {
  return execFileSync(python, ['--version'], { encoding: 'utf8' }).trim();
}
