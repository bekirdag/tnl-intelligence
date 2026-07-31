import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
  encoding: 'utf8',
});
const packages = JSON.parse(output);
const packageDetails = Array.isArray(packages)
  ? packages[0]
  : Object.values(packages)[0];
const files = packageDetails?.files?.map((entry) => entry.path) ?? [];
const prohibited = files.filter((file) => {
  return (
    file.includes('node_modules/') ||
    file.includes('/test/') ||
    file.includes('/scripts/') ||
    file.includes('__pycache__') ||
    file.endsWith('.log') ||
    file.endsWith('.env') ||
    file.includes('.git/')
  );
});
if (prohibited.length > 0) {
  throw new Error(`Prohibited package files: ${prohibited.join(', ')}`);
}
for (const required of [
  'package.json',
  'README.md',
  'LICENSE',
  'src/index.js',
  'dist/src/index.js',
  'dist/src/index.d.ts',
]) {
  if (!files.includes(required)) {
    throw new Error(`Missing package file: ${required}`);
  }
}
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
if (manifest.name !== '@theneuralledger/piece-tnl-intelligence') {
  throw new Error('Unexpected package name');
}
process.stdout.write(`Package inventory verified: ${files.length} files\n`);
