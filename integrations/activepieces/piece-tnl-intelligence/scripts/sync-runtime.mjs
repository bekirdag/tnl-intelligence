import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

const sourceRoot = 'src';
const compiledRoot = 'dist/src';

function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function cleanRuntime() {
  rmSync('dist', { recursive: true, force: true });
  for (const path of walk(sourceRoot)) {
    if (path.endsWith('.js')) {
      rmSync(path);
    }
  }
}

if (process.argv.includes('--clean')) {
  cleanRuntime();
  process.exit(0);
}

for (const source of walk(compiledRoot)) {
  if (!source.endsWith('.js')) {
    continue;
  }
  const destination = join(sourceRoot, relative(compiledRoot, source));
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}
