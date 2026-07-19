import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
  createResearchHttpServer,
  listenResearchHttp,
} from '../../packages/research/dist/index.js';

const root = resolve(import.meta.dirname, '../..');
const artifacts = resolve(root, '.artifacts/tool-05');
await mkdir(artifacts, { recursive: true });

const orchestrator = new ResearchOrchestrator({
  adapters: ['tnl', 'docdex', 'web'].map(
    (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
  ),
  codali: new DeterministicCodaliAdapter(),
  now: () => new Date('2026-07-18T12:00:00.000Z'),
});
const server = createResearchHttpServer({
  orchestrator,
  authorize: async (request) => {
    const tenantId = request.headers['x-tnl-tenant-id'];
    const actorId = request.headers['x-tnl-user-id'];
    if (typeof tenantId !== 'string' || typeof actorId !== 'string') return undefined;
    return {
      tenantId,
      actorId,
      scopes: new Set(['research:run', 'research:read', 'research:delete']),
    };
  },
});
const address = await listenResearchHttp(server, { port: 0 });
const base = `http://${address.host}:${address.port}`;
const browser = await chromium.launch({ headless: true });

try {
  await exerciseDesktop(browser, base);
  await exerciseCompact(browser, base, { width: 1024, height: 768 }, 'tablet');
  await exerciseCompact(browser, base, { width: 480, height: 800 }, 'narrow-panel');
  await exerciseCompact(browser, base, { width: 390, height: 844 }, 'mobile');
  console.log('Tool 05 research browser qualification passed.');
} finally {
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}

async function exerciseDesktop(browserInstance, url) {
  const page = await browserInstance.newPage({ viewport: { width: 1440, height: 900 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByText('Online', { exact: true }).waitFor();
  await page.keyboard.press('Tab');
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY');
  assert.equal(await page.locator('.empty-state h1').textContent(), 'Research workspace');
  assert.equal(
    await page.locator('.bot-identity img').evaluate((image) => image.naturalWidth),
    256,
  );

  let delayed = true;
  await page.route('**/api/research/runs', async (route) => {
    if (!delayed) return route.continue();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
    await route.abort('aborted');
  });
  await page.getByRole('button', { name: 'Run research' }).click();
  await page.getByRole('heading', { name: 'Gathering evidence' }).waitFor();
  assert.equal(await page.locator('#result-pane').getAttribute('aria-busy'), 'true');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('heading', { name: 'Research run failed' }).waitFor();
  delayed = false;
  await page.unroute('**/api/research/runs');
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.locator('#research-result').waitFor();
  assert.match(await page.locator('#result-skill').textContent(), /complete/);
  assert.ok((await page.locator('.claim-row').count()) >= 1);
  await page.getByRole('tab', { name: 'Timeline' }).click();
  assert.ok((await page.locator('#tab-timeline .timeline-row').count()) >= 1);
  await page.getByRole('tab', { name: 'Run details' }).click();
  assert.match(await page.locator('#tab-run').textContent(), /Graders/);
  assert.equal(await hasHorizontalOverflow(page), false);
  assert.deepEqual(await visibleOutsideViewport(page), []);
  assert.deepEqual(await unlabeledControls(page), []);
  await page.screenshot({ path: resolve(artifacts, 'research-desktop.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await page.close();
}

async function exerciseCompact(browserInstance, url, viewport, name) {
  const page = await browserInstance.newPage({
    viewport,
    deviceScaleFactor: 1,
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Run research' }).click();
  await page.locator('#research-result').waitFor();
  await page.getByRole('tab', { name: 'Comparison' }).click();
  assert.equal(await hasHorizontalOverflow(page), false);
  assert.deepEqual(await visibleOutsideViewport(page), []);
  assert.deepEqual(await unlabeledControls(page), []);
  await page.screenshot({ path: resolve(artifacts, `research-${name}.png`), fullPage: true });
  assert.deepEqual(errors, []);
  await page.close();
}

async function hasHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

async function visibleOutsideViewport(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, input, select, textarea, h1, h2, p')]
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
      })
      .map((element) => `${element.tagName}:${element.textContent?.trim().slice(0, 30)}`),
  );
}

async function unlabeledControls(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, input, select, textarea')]
      .filter((element) => {
        const label = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');
        const wrapped = element.closest('label')?.textContent?.trim();
        const explicit = element.id
          ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent?.trim()
          : undefined;
        const ownText = element.textContent?.trim();
        return !label && !wrapped && !explicit && !ownText;
      })
      .map((element) => `${element.tagName}#${element.id}`),
  );
}
