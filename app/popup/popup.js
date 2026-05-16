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
  loadReadingPrefs();
  loadTTSState();
  loadColorPalette();
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

// ===== Color Palette =====

const PALETTE_PRESETS = {
  deuteranopia: { bg: '#FEFAE0', text: '#023047', link: '#E07B39' },
  protanopia:   { bg: '#EAF4FB', text: '#1B2A4A', link: '#D4A017' },
  tritanopia:   { bg: '#FFF0F0', text: '#1B4332', link: '#C0392B' },
  monochrome:   { bg: '#FFFFFF', text: '#111111', link: '#444444' },
};

function computeEffective(activePalette, customEnabled, customColors) {
  if (customEnabled && customColors) {
    const type = (activePalette && activePalette !== 'none') ? activePalette : 'custom';
    return { colors: customColors, type };
  }
  if (activePalette && activePalette !== 'none') {
    return { colors: PALETTE_PRESETS[activePalette], type: activePalette };
  }
  return { colors: null, type: 'none' };
}

function updatePaletteUI(activePalette, customEnabled) {
  document.querySelectorAll('.palette-btn[data-palette]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.palette === activePalette)
  );
  const customBtn = document.getElementById('btn-custom-toggle');
  customBtn.textContent = customEnabled ? 'Remove' : 'Apply';
  customBtn.classList.toggle('active', customEnabled);
}

async function applyPaletteState() {
  const { activePalette = 'none', customEnabled = false, customColors } =
    await chrome.storage.local.get(['activePalette', 'customEnabled', 'customColors']);
  const effective = computeEffective(activePalette, customEnabled, customColors);
  sendToContent('SET_COLOR_PALETTE', effective);
  updatePaletteUI(activePalette, customEnabled);
}

async function loadColorPalette() {
  const { activePalette = 'none', customEnabled = false, customColors } =
    await chrome.storage.local.get(['activePalette', 'customEnabled', 'customColors']);
  updatePaletteUI(activePalette, customEnabled);
  if (customColors) {
    document.getElementById('color-bg').value = customColors.bg;
    document.getElementById('color-text').value = customColors.text;
  }
}

document.querySelectorAll('.palette-btn[data-palette]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const name = btn.dataset.palette;
    if (name === 'none') {
      await chrome.storage.local.set({ activePalette: 'none', customEnabled: false });
    } else {
      await chrome.storage.local.set({ activePalette: name });
    }
    applyPaletteState();
  });
});

document.getElementById('btn-custom-toggle').addEventListener('click', async () => {
  const { customEnabled = false } = await chrome.storage.local.get('customEnabled');
  await chrome.storage.local.set({ customEnabled: !customEnabled });
  applyPaletteState();
});

['color-bg', 'color-text'].forEach(id => {
  document.getElementById(id).addEventListener('change', async () => {
    const customColors = {
      bg:   document.getElementById('color-bg').value,
      text: document.getElementById('color-text').value,
      link: document.getElementById('color-text').value,
    };
    await chrome.storage.local.set({ customColors });
    applyPaletteState();
  });
});

// ===== Reading Controls =====

const PREF_DEFAULTS = { fontSize: 100, lineHeight: 1.5, letterSpacing: 0, wordSpacing: 0 };

const SLIDERS = [
  { id: 'ctrl-font-size',      key: 'fontSize',      valId: 'val-font-size',      fmt: v => v + '%' },
  { id: 'ctrl-line-height',    key: 'lineHeight',    valId: 'val-line-height',    fmt: v => parseFloat(v).toFixed(1) },
  { id: 'ctrl-letter-spacing', key: 'letterSpacing', valId: 'val-letter-spacing', fmt: v => v + 'px' },
  { id: 'ctrl-word-spacing',   key: 'wordSpacing',   valId: 'val-word-spacing',   fmt: v => v + 'px' },
];

async function loadReadingPrefs() {
  const { readingPrefs = {} } = await chrome.storage.local.get('readingPrefs');
  const prefs = { ...PREF_DEFAULTS, ...readingPrefs };
  SLIDERS.forEach(({ id, key, valId, fmt }) => {
    document.getElementById(id).value = prefs[key];
    document.getElementById(valId).textContent = fmt(prefs[key]);
  });
}

SLIDERS.forEach(({ id, key, valId, fmt }) => {
  document.getElementById(id).addEventListener('input', async e => {
    const val = parseFloat(e.target.value);
    document.getElementById(valId).textContent = fmt(val);
    const { readingPrefs = {} } = await chrome.storage.local.get('readingPrefs');
    const prefs = { ...PREF_DEFAULTS, ...readingPrefs, [key]: val };
    await chrome.storage.local.set({ readingPrefs: prefs });
    sendToContent('SET_READING_PREFS', { prefs });
  });
});

// ===== TTS =====

let ttsState = 'stopped';

async function loadTTSState() {
  const res = await sendToContent('GET_TTS_STATE');
  if (res?.speaking && !res?.paused) ttsState = 'playing';
  else if (res?.paused) ttsState = 'paused';
  else ttsState = 'stopped';
  updateTTSUI();
} // 'stopped' | 'playing' | 'paused'

const TTS_ICON = '<img src="../images/read_aloud.png" class="tts-icon" alt="">';

function updateTTSUI() {
  const mainBtn = document.getElementById('btn-tts-main');
  const stopBtn = document.getElementById('btn-tts-stop');
  if (ttsState === 'stopped') {
    mainBtn.innerHTML = `${TTS_ICON} Read Aloud`;
    mainBtn.classList.remove('active');
    stopBtn.classList.add('hidden');
  } else if (ttsState === 'playing') {
    mainBtn.innerHTML = `${TTS_ICON} Pause`;
    mainBtn.classList.add('active');
    stopBtn.classList.remove('hidden');
  } else {
    mainBtn.innerHTML = `${TTS_ICON} Resume`;
    mainBtn.classList.add('active');
    stopBtn.classList.remove('hidden');
  }
}

document.getElementById('btn-tts-main').addEventListener('click', async () => {
  if (ttsState === 'stopped') {
    const res = await sendToContent('START_TTS');
    if (res?.started) { ttsState = 'playing'; updateTTSUI(); }
  } else if (ttsState === 'playing') {
    await sendToContent('PAUSE_TTS');
    ttsState = 'paused';
    updateTTSUI();
  } else {
    await sendToContent('RESUME_TTS');
    ttsState = 'playing';
    updateTTSUI();
  }
});

document.getElementById('btn-tts-stop').addEventListener('click', async () => {
  await sendToContent('STOP_TTS');
  ttsState = 'stopped';
  updateTTSUI();
});

// Init
loadState();
