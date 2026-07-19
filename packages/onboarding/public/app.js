const sessionHeaders = () => ({
  'content-type': 'application/json',
  'x-tnl-user': 'local-developer',
  'x-tnl-tenant': 'local-evaluation',
  'x-tnl-recent-auth': String(Date.now()),
});

let responseText = '{}';
let transientSecret = '';

const output = document.querySelector('#response-output');
const responseStatus = document.querySelector('#response-status');
const credentialStatus = document.querySelector('#credential-status');
const secretDialog = document.querySelector('#secret-dialog');
const secretValue = document.querySelector('#secret-value');

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => selectView(button.dataset.view));
});

document.querySelector('#request-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const endpoint = document.querySelector('#endpoint').value;
  const query = document.querySelector('#query').value.trim();
  const url = new URL(endpoint, location.origin);
  if (query && (endpoint.includes('news') || endpoint.includes('search')))
    url.searchParams.set('q', query);
  responseStatus.textContent = 'Loading';
  const started = performance.now();
  try {
    const response = await fetch(url);
    const data = await response.json();
    responseText = JSON.stringify(data, null, 2);
    output.textContent = responseText;
    responseStatus.textContent = `${response.status} · ${Math.round(performance.now() - started)} ms · static sample`;
  } catch {
    responseText = JSON.stringify({ error: { code: 'network_error' } }, null, 2);
    output.textContent = responseText;
    responseStatus.textContent = 'Request failed';
  }
});

document.querySelector('#copy-response').addEventListener('click', async () => {
  await navigator.clipboard.writeText(responseText);
  responseStatus.textContent = 'JSON copied';
});

document.querySelector('#credential-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const scopes = form.getAll('scope').map(String);
  const response = await developerFetch('/developer/api/keys', {
    method: 'POST',
    body: JSON.stringify({
      name: form.get('name'),
      scopes,
      lifetimeDays: Number(form.get('lifetimeDays')),
    }),
  });
  const body = await response.json();
  if (!response.ok) return showCredentialError(body);
  transientSecret = body.data.secret;
  secretValue.value = transientSecret;
  secretDialog.showModal();
  await developerFetch('/developer/api/checkpoints', {
    method: 'POST',
    body: JSON.stringify({ event: 'key_viewed' }),
  });
  await loadCredentials();
});

document.querySelector('#copy-secret').addEventListener('click', async () => {
  if (!transientSecret) return;
  await navigator.clipboard.writeText(transientSecret);
  document.querySelector('#copy-secret').textContent = 'Copied';
});

secretDialog.addEventListener('close', () => {
  transientSecret = '';
  secretValue.value = '';
  document.querySelector('#copy-secret').textContent = 'Copy key';
});

document.querySelector('#refresh-usage').addEventListener('click', loadUsage);

async function selectView(name) {
  document.querySelectorAll('.nav-item').forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach((view) => {
    const active = view.id === name;
    view.hidden = !active;
    view.classList.toggle('active', active);
  });
  if (name === 'credentials') await loadCredentials();
  if (name === 'usage') await loadUsage();
}

async function loadCredentials() {
  const response = await developerFetch('/developer/api/keys');
  const body = await response.json();
  if (!response.ok) return showCredentialError(body);
  const rows = document.querySelector('#credential-rows');
  rows.replaceChildren();
  body.data.forEach((credential) => rows.append(credentialRow(credential)));
  credentialStatus.textContent = body.data.length
    ? `${body.data.length} credential records`
    : 'No credentials';
}

function credentialRow(credential) {
  const row = document.createElement('tr');
  [
    credential.name,
    `tnl_dev_${credential.prefix}`,
    credential.scopes.join(', '),
    credential.status,
    new Date(credential.expiresAt).toLocaleDateString(),
  ].forEach((value) => {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(cell);
  });
  const actions = document.createElement('td');
  actions.className = 'actions';
  if (credential.status === 'active') {
    actions.append(actionButton('Rotate', () => rotate(credential.id)));
    actions.append(actionButton('Revoke', () => revoke(credential.id), 'danger'));
  }
  row.append(actions);
  return row;
}

function actionButton(label, action, className = 'secondary') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

async function rotate(id) {
  const response = await developerFetch(`/developer/api/keys/${encodeURIComponent(id)}/rotate`, {
    method: 'POST',
  });
  const body = await response.json();
  if (!response.ok) return showCredentialError(body);
  transientSecret = body.data.secret;
  secretValue.value = transientSecret;
  secretDialog.showModal();
  await loadCredentials();
}

async function revoke(id) {
  const response = await developerFetch(`/developer/api/keys/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
  });
  const body = await response.json();
  if (!response.ok) return showCredentialError(body);
  await loadCredentials();
}

async function loadUsage() {
  const response = await developerFetch('/developer/api/usage');
  const body = await response.json();
  if (!response.ok) return;
  const usage = body.data;
  document.querySelector('#usage-tier').textContent = usage.tier;
  document.querySelector('#usage-requests').textContent =
    `${usage.requestCount} / ${usage.dailyQuota}`;
  document.querySelector('#usage-remaining').textContent = String(usage.remaining);
  document.querySelector('#usage-reset').textContent = new Date(usage.resetAt).toLocaleString();
  const list = document.querySelector('#checkpoint-list');
  list.replaceChildren();
  ['key_viewed', 'api_first_success', 'mcp_first_success', 'sdk_first_success'].forEach((event) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = event.replaceAll('_', ' ');
    const value = document.createElement('strong');
    value.textContent = usage.checkpoints[event]
      ? new Date(usage.checkpoints[event]).toLocaleString()
      : 'Pending';
    item.append(label, value);
    list.append(item);
  });
}

function showCredentialError(body) {
  const error = body.error ?? {};
  credentialStatus.textContent = `${error.message ?? 'Request failed'}. ${error.nextAction ?? ''}`;
}

function developerFetch(path, init = {}) {
  return fetch(path, { ...init, headers: { ...sessionHeaders(), ...(init.headers ?? {}) } });
}

async function loadContract() {
  try {
    const contract = await (await fetch('/openapi.json')).json();
    document.querySelector('#contract-version').textContent = `API ${contract.info.version}`;
  } catch {
    document.querySelector('#contract-version').textContent = 'Contract unavailable';
  }
}

loadContract();
document.querySelector('#request-form').requestSubmit();
