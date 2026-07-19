import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '../..');
const screenshotDirectory = resolve(root, '.artifacts', 'tool-03', 'screenshots');
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn('node', ['packages/onboarding/dist/bin.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    TNL_ONBOARDING_PORT: String(port),
    TNL_OPENAPI_PATH: resolve(root, 'openapi', 'tnl.openapi.json'),
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let browser;

try {
  await waitForHealth(`${baseUrl}/healthz`, server);
  await mkdir(screenshotDirectory, { recursive: true });
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  await verifyViewport({ width: 1440, height: 900 }, 'desktop');
  await verifyViewport({ width: 390, height: 844 }, 'mobile');
  process.stdout.write(`Tool 03 browser qualification passed: ${screenshotDirectory}\n`);
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await waitForExit(server);
  }
}

async function verifyViewport(viewport, name) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('#response-output').filter({ hasText: 'sample-story-1' }).waitFor();
  assert.equal(await page.locator('h1').first().textContent(), 'API Explorer');
  assert.equal(
    await page
      .locator('#response-status')
      .textContent()
      .then((text) => /^200/.test(text)),
    true,
  );

  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    elements: [...document.querySelectorAll('button, input, select, h1, h2, table')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
      })
      .map((element) => element.tagName),
  }));
  assert.ok(overflow.document <= 1, `document overflow at ${name}: ${overflow.document}`);
  assert.deepEqual(overflow.elements, [], `element overflow at ${name}`);

  await page.getByRole('button', { name: 'Credentials' }).click();
  await page.getByRole('button', { name: 'Create key' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const oneTimeSecret = await page.locator('#secret-value').inputValue();
  assert.match(oneTimeSecret, /^tnl_dev_[a-f0-9]{12}\./);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#secret-value')?.value === '');
  assert.equal(await page.locator('#secret-value').inputValue(), '');

  await page.getByRole('button', { name: 'Usage' }).click();
  await page.locator('#usage-tier').filter({ hasText: 'developer-evaluation' }).waitFor();
  const storage = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: (await indexedDB.databases()).length,
    passwordInputs: document.querySelectorAll('input[type="password"]').length,
    unlabeledControls: [...document.querySelectorAll('button, input, select')].filter((element) => {
      const label = element.getAttribute('aria-label') || element.textContent?.trim();
      const wrapped = element.closest('label')?.textContent?.trim();
      return !label && !wrapped;
    }).length,
  }));
  assert.deepEqual(storage, {
    local: 0,
    session: 0,
    databases: 0,
    passwordInputs: 0,
    unlabeledControls: 0,
  });
  assert.deepEqual(consoleErrors, []);
  await page.screenshot({
    path: resolve(screenshotDirectory, `${name}.png`),
    fullPage: true,
  });
  await context.close();
}

async function freePort() {
  const socket = createServer();
  await new Promise((resolvePromise, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = socket.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise((resolvePromise) => socket.close(resolvePromise));
  return address.port;
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Onboarding server exited with ${child.exitCode}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function waitForExit(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolvePromise) => child.once('exit', resolvePromise));
}
