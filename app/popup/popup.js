async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(type, data = {}) {
  try {
    const tab = await getCurrentTab();
    if (!tab?.id) return null;
    return await chrome.tabs.sendMessage(tab.id, { type, ...data });
  } catch {
    return null;
  }
}

async function loadState() {
  const response = await sendToContent('GET_ACTIVE_MODES');

  if (!response) {
    document.getElementById('no-access-msg').classList.remove('hidden');
    document.getElementById('main-content').classList.add('hidden');
    return;
  }

  const { activeModes = {} } = response;
  document.querySelectorAll('[data-mode]').forEach(input => {
    input.checked = activeModes[input.dataset.mode] || false;
  });

  loadIssues();
  checkApiKey();
}

async function loadIssues() {
  const container = document.getElementById('issues-container');
  const response = await sendToContent('DETECT_ISSUES');

  if (!response) {
    container.innerHTML = '<div class="state-text">Could not scan this page.</div>';
    return;
  }

  const { issues = [] } = response;

  if (issues.length === 0) {
    container.innerHTML = '<div class="no-issues"><span>✓</span> No major issues detected</div>';
    return;
  }

  container.innerHTML = issues
    .map(
      issue => `
      <div class="issue-item">
        <div class="issue-dot ${issue.severity}"></div>
        <span>${issue.message}</span>
      </div>`
    )
    .join('');
}

async function checkApiKey() {
  const { aiApiKey } = await chrome.storage.local.get('aiApiKey');
  if (!aiApiKey) {
    document.getElementById('no-api-key').classList.remove('hidden');
  }
}

async function toggleMode(mode, enabled) {
  const { activeModes = {} } = await chrome.storage.local.get('activeModes');
  activeModes[mode] = enabled;
  await chrome.storage.local.set({ activeModes });
  await sendToContent('TOGGLE_MODE', { mode, enabled });
}

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  window.close();
}

// ===== Event Listeners =====

document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('settings-link')?.addEventListener('click', openSettings);

document.querySelectorAll('[data-mode]').forEach(input => {
  input.addEventListener('change', e => {
    toggleMode(e.target.dataset.mode, e.target.checked);
  });
});

document.getElementById('btn-simplify').addEventListener('click', async function () {
  const resultEl = document.getElementById('ai-result');
  const isSimplified = this.dataset.simplified === 'true';

  if (isSimplified) {
    await sendToContent('RESTORE_ORIGINAL');
    this.innerHTML = '<span>✨</span> Simplify Page';
    this.dataset.simplified = '';
    resultEl.classList.add('hidden');
    return;
  }

  this.disabled = true;
  this.classList.add('loading');
  this.innerHTML = 'Simplifying...';
  resultEl.classList.add('hidden');

  const response = await sendToContent('SIMPLIFY_PAGE');

  this.disabled = false;
  this.classList.remove('loading');

  if (response?.success) {
    this.innerHTML = '<span>↩️</span> Restore Original';
    this.dataset.simplified = 'true';
    resultEl.textContent = '✓ Page simplified to easier language.';
    resultEl.className = 'ai-result';
  } else {
    this.innerHTML = '<span>✨</span> Simplify Page';
    resultEl.textContent = response?.error || 'Could not simplify. Check your API key in settings.';
    resultEl.className = 'ai-result error';
  }
  resultEl.classList.remove('hidden');
});

document.getElementById('btn-summarize').addEventListener('click', async function () {
  const resultEl = document.getElementById('ai-result');

  this.disabled = true;
  this.classList.add('loading');
  this.innerHTML = 'Summarizing...';
  resultEl.classList.add('hidden');

  const contentRes = await sendToContent('GET_PAGE_CONTENT');

  if (!contentRes?.content) {
    this.disabled = false;
    this.classList.remove('loading');
    this.innerHTML = '<span>📋</span> Summarize Page';
    resultEl.textContent = 'Could not read page content.';
    resultEl.className = 'ai-result error';
    resultEl.classList.remove('hidden');
    return;
  }

  const summaryRes = await chrome.runtime.sendMessage({
    type: 'SUMMARIZE_PAGE',
    content: contentRes.content,
    title: contentRes.title,
  });

  this.disabled = false;
  this.classList.remove('loading');
  this.innerHTML = '<span>📋</span> Summarize Page';

  if (summaryRes?.summary) {
    resultEl.innerHTML = renderMarkdown(summaryRes.summary);
    resultEl.className = 'ai-result';
  } else {
    resultEl.textContent = summaryRes?.error || 'Could not summarize. Check your API key in settings.';
    resultEl.className = 'ai-result error';
  }
  resultEl.classList.remove('hidden');
});

function renderMarkdown(text) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => esc(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  const out = [];
  let inList = false;

  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${inline(t.slice(4))}</h3>`);
    } else if (t.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${inline(t.slice(3))}</h2>`);
    } else if (t.startsWith('# ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h1>${inline(t.slice(2))}</h1>`);
    } else if (/^[-*] /.test(t)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(t.slice(2))}</li>`);
    } else if (/^\d+\. /.test(t)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(t.replace(/^\d+\. /, ''))}</li>`);
    } else if (t === '') {
      if (inList) { out.push('</ul>'); inList = false; }
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${inline(t)}</p>`);
    }
  }

  if (inList) out.push('</ul>');
  return out.join('');
}

// Init
loadState();
