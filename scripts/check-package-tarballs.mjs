import { execFileSync } from 'node:child_process';

const packages = [
  { workspace: '@theneuralledger/sdk', bin: false },
  { workspace: '@theneuralledger/mcp', bin: true },
  { workspace: '@theneuralledger/cli', bin: true },
];
const forbidden = [
  /(^|\/)test\//,
  /(^|\/)src\//,
  /\.env($|\.)/,
  /\.tsbuildinfo$/,
  /(^|\/)coverage\//,
  /(^|\/)node_modules\//,
];

for (const item of packages) {
  const output = execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--workspace', item.workspace],
    { encoding: 'utf8' },
  );
  const [manifest] = JSON.parse(output);
  if (!manifest || !Array.isArray(manifest.files)) {
    throw new Error(`npm did not return a file manifest for ${item.workspace}`);
  }
  const files = manifest.files.map((entry) => entry.path);
  const unexpected = files.filter((path) => forbidden.some((pattern) => pattern.test(path)));
  if (unexpected.length > 0) {
    throw new Error(`${item.workspace} contains forbidden files: ${unexpected.join(', ')}`);
  }
  if (!files.includes('dist/index.js') || !files.includes('dist/index.d.ts')) {
    throw new Error(`${item.workspace} is missing its built entry points`);
  }
  const packageJson = JSON.parse(
    execFileSync('npm', ['pkg', 'get', '--json', '--workspace', item.workspace], {
      encoding: 'utf8',
    }),
  );
  if (item.bin && !packageJson[item.workspace]?.bin) {
    throw new Error(`${item.workspace} is missing its executable declaration`);
  }
  process.stdout.write(`${item.workspace}: ${files.length} publishable files verified\n`);
}
