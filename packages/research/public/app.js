const state = { skills: [], result: null, controller: null };
const elements = Object.fromEntries(
  [
    'research-form',
    'skill-list',
    'question',
    'from',
    'to',
    'depth',
    'run-button',
    'cancel-button',
    'result-pane',
    'empty-state',
    'loading-state',
    'loading-copy',
    'failure-state',
    'failure-copy',
    'research-result',
    'result-skill',
    'direct-answer',
    'executive-summary',
    'warning-band',
    'tab-evidence',
    'tab-timeline',
    'tab-comparison',
    'tab-impact',
    'tab-run',
    'service-state',
    'copy-citations',
    'export-json',
    'retry-button',
  ].map((id) => [id, document.getElementById(id)]),
);

const now = new Date();
const from = new Date(now.getTime() - 7 * 86_400_000);
elements.from.value = localDateTime(from);
elements.to.value = localDateTime(now);

void initialize();

async function initialize() {
  try {
    const response = await api('/api/skills');
    state.skills = response.data;
    renderSkills();
    elements['service-state'].textContent = 'Online';
    elements['service-state'].classList.add('online');
  } catch {
    const catalog = await fetch('/skills.json').then((response) => response.json());
    state.skills = catalog;
    renderSkills();
    elements['service-state'].textContent = 'Offline';
  }
}

elements['research-form'].addEventListener('submit', async (event) => {
  event.preventDefault();
  await runResearch();
});
elements['cancel-button'].addEventListener('click', () => state.controller?.abort());
elements['retry-button'].addEventListener('click', () => void runResearch());
elements['copy-citations'].addEventListener('click', async () => {
  const text = (state.result?.citations ?? [])
    .map((item) => (item.url ? `${item.label} ${item.url}` : item.label))
    .join('\n');
  await navigator.clipboard.writeText(text);
  elements['copy-citations'].textContent = 'Copied';
  setTimeout(() => {
    elements['copy-citations'].textContent = 'Copy citations';
  }, 1200);
});
elements['export-json'].addEventListener('click', () => {
  if (!state.result) return;
  const blob = new Blob([`${JSON.stringify(state.result, null, 2)}\n`], {
    type: 'application/json',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${state.result.resultId}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
document.querySelector('.tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-tab]');
  if (!button) return;
  selectTab(button.dataset.tab);
});

async function runResearch() {
  const selected = document.querySelector('input[name="skill"]:checked');
  if (!selected) return;
  state.controller?.abort();
  state.controller = new AbortController();
  showState('loading');
  elements['result-pane'].setAttribute('aria-busy', 'true');
  elements['run-button'].disabled = true;
  elements['cancel-button'].disabled = false;
  const fromIso = new Date(elements.from.value).toISOString();
  const toIso = new Date(elements.to.value).toISOString();
  const task = {
    schemaVersion: '1.0',
    taskId: `task_${crypto.randomUUID()}`,
    taskType: selected.value,
    question: elements.question.value.trim(),
    asOf: toIso,
    timeWindow: { from: fromIso, to: toIso },
    depth: elements.depth.value,
    sourcePolicy: {
      version: 'research-sources-1',
      requirePrimary: selected.value === 'event_validation',
      minimumIndependentSources: selected.value === 'weekly_consequential' ? 3 : 2,
      freshnessMs: 7 * 86_400_000,
    },
    budget: {
      maxToolCalls: 12,
      maxDurationMs: 45000,
      maxInputTokens: 24000,
      maxOutputTokens: 4000,
      maxSources: 20,
      maxCostUsd: 0.25,
    },
    outputFormat: 'json',
    locale: document.documentElement.lang || 'en',
  };
  try {
    const response = await api('/api/research/runs', {
      method: 'POST',
      body: JSON.stringify({ task }),
      signal: state.controller.signal,
    });
    state.result = response.data;
    renderResult(response.data);
    showState('result');
  } catch (error) {
    if (error.name === 'AbortError') {
      elements['failure-copy'].textContent = 'The research run was cancelled before completion.';
    } else {
      elements['failure-copy'].textContent =
        error.message || 'The research service could not complete this run.';
    }
    showState('failure');
  } finally {
    elements['result-pane'].setAttribute('aria-busy', 'false');
    elements['run-button'].disabled = false;
    elements['cancel-button'].disabled = true;
    state.controller = null;
  }
}

function renderSkills() {
  elements['skill-list'].replaceChildren(
    ...state.skills.map((skill, index) => {
      const label = document.createElement('label');
      label.className = 'skill-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'skill';
      input.value = skill.taskType;
      input.checked = index === 0;
      const span = document.createElement('span');
      span.textContent = skill.name;
      label.append(input, span);
      return label;
    }),
  );
}

function renderResult(result) {
  const skill = state.skills.find((item) => item.id === result.skill.id);
  elements['result-skill'].textContent =
    `${skill?.name ?? result.skill.id} · ${result.skill.version} · ${result.completionReason}`;
  elements['direct-answer'].textContent = result.directAnswer;
  elements['executive-summary'].textContent = result.executiveSummary;
  elements['warning-band'].hidden = result.warnings.length === 0;
  elements['warning-band'].textContent = result.warnings.join(' ');
  renderEvidence(result);
  renderTimeline(result);
  renderComparison(result);
  renderImpact(result);
  renderRun(result);
  selectTab('evidence');
}

function renderEvidence(result) {
  const title = heading(`Claims and evidence (${result.claims.length})`);
  const rows = result.claims.map((claim) => {
    const row = div('claim-row');
    const meta = div('row-meta');
    meta.append(
      badge(claim.classification, claim.classification === 'fact' ? 'support' : 'inference'),
    );
    meta.append(textNode(`${Math.round(claim.confidence * 100)}% confidence`));
    const p = document.createElement('p');
    p.textContent = claim.statement;
    row.append(meta, p);
    const linked = result.evidence.filter(
      (item) =>
        claim.supportingEvidenceIds.includes(item.evidenceId) ||
        claim.contradictingEvidenceIds.includes(item.evidenceId),
    );
    for (const item of linked) {
      const source = div('evidence-row');
      const sourceMeta = div('row-meta');
      sourceMeta.append(
        badge(
          claim.contradictingEvidenceIds.includes(item.evidenceId) ? 'contradicts' : 'supports',
          claim.contradictingEvidenceIds.includes(item.evidenceId) ? 'contradict' : 'support',
        ),
      );
      sourceMeta.append(
        textNode(
          `${item.publisher} · ${item.freshness} · ${item.primary ? 'primary' : 'secondary'}`,
        ),
      );
      const body = document.createElement('p');
      body.textContent = item.excerpt || item.statement;
      source.append(sourceMeta, body);
      if (item.canonicalUrl) {
        const link = document.createElement('a');
        link.href = item.canonicalUrl;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = item.title;
        source.append(link);
      }
      row.append(source);
    }
    return row;
  });
  elements['tab-evidence'].replaceChildren(
    title,
    ...(rows.length ? rows : [emptyCopy('No supported claims were produced.')]),
  );
}

function renderTimeline(result) {
  const rows = result.timeline.map((entry) => {
    const row = div('timeline-row');
    const meta = div('row-meta');
    meta.textContent = `${new Date(entry.timestamp).toLocaleString()} · ${entry.kind}`;
    const p = document.createElement('p');
    p.textContent = entry.label;
    row.append(meta, p);
    return row;
  });
  elements['tab-timeline'].replaceChildren(
    heading('Evidence timeline'),
    ...(rows.length ? rows : [emptyCopy('No timeline entries are available.')]),
  );
}

function renderComparison(result) {
  const table = document.createElement('table');
  table.className = 'comparison';
  const head = document.createElement('thead');
  head.innerHTML =
    '<tr><th>Source</th><th>Classification</th><th>Claims</th><th>Freshness</th></tr>';
  const body = document.createElement('tbody');
  for (const item of result.evidence) {
    const row = document.createElement('tr');
    for (const value of [
      item.publisher,
      item.primary ? 'Primary' : 'Secondary',
      String(item.relationships.length),
      item.freshness,
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
  table.append(head, body);
  elements['tab-comparison'].replaceChildren(
    heading('Source comparison'),
    result.evidence.length ? table : emptyCopy('No source comparison is available.'),
  );
}

function renderImpact(result) {
  const rows = result.impactPaths.map((path) => {
    const row = div('impact-row');
    const meta = div('row-meta');
    meta.textContent = `${path.relationship} · ${path.horizon}`;
    const p = document.createElement('p');
    p.textContent = path.nodes.join(' → ');
    row.append(meta, p);
    return row;
  });
  elements['tab-impact'].replaceChildren(
    heading('Impact paths'),
    ...(rows.length ? rows : [emptyCopy('No impact path met the evidence threshold.')]),
  );
}

function renderRun(result) {
  const grid = div('run-grid');
  const used = result.budget.used;
  const cells = [
    ['Completion', result.completionReason],
    ['As of', new Date(result.asOf).toLocaleString()],
    ['Checked', new Date(result.lastCheckedAt).toLocaleString()],
    ['Orchestrator', `${result.orchestration.provider} ${result.orchestration.version}`],
    ['Tool calls', `${used.toolCalls}/${result.budget.limit.maxToolCalls}`],
    ['Sources', `${used.sources}/${result.budget.limit.maxSources}`],
    ['Input tokens', String(used.inputTokens)],
    ['Output tokens', String(used.outputTokens)],
    ['Cost', `$${used.costUsd.toFixed(4)}`],
  ];
  for (const [label, value] of cells) {
    const cell = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = label;
    cell.append(strong, textNode(value));
    grid.append(cell);
  }
  const graders = result.graders.map((grader) => {
    const row = div('detail-row');
    row.textContent = `${grader.passed ? 'Pass' : 'Review'} · ${grader.grader} · ${Math.round(grader.score * 100)}% · ${grader.details}`;
    return row;
  });
  elements['tab-run'].replaceChildren(heading('Run details'), grid, heading('Graders'), ...graders);
}

function selectTab(name) {
  for (const button of document.querySelectorAll('[data-tab]'))
    button.setAttribute('aria-selected', String(button.dataset.tab === name));
  for (const panel of document.querySelectorAll('.tab-panel'))
    panel.hidden = panel.id !== `tab-${name}`;
}

function showState(name) {
  elements['empty-state'].hidden = name !== 'empty';
  elements['loading-state'].hidden = name !== 'loading';
  elements['failure-state'].hidden = name !== 'failure';
  elements['research-result'].hidden = name !== 'result';
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    headers.set('x-tnl-tenant-id', 'tenant_local_demo');
    headers.set('x-tnl-user-id', 'user_local_demo');
  }
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Research API returned HTTP ${response.status}`);
  return body;
}

function localDateTime(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function heading(value) {
  const node = document.createElement('h2');
  node.className = 'section-title';
  node.textContent = value;
  return node;
}
function div(className) {
  const node = document.createElement('div');
  node.className = className;
  return node;
}
function badge(value, className) {
  const node = document.createElement('span');
  node.className = `badge ${className}`;
  node.textContent = value;
  return node;
}
function textNode(value) {
  return document.createTextNode(value);
}
function emptyCopy(value) {
  const node = document.createElement('p');
  node.textContent = value;
  return node;
}
