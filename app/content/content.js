const MODES = {
  highContrast: 'readeasy-high-contrast',
  dyslexia: 'readeasy-dyslexia',
  focus: 'readeasy-focus',
  screenReader: 'readeasy-screen-reader',
};

function setMode(mode, enabled) {
  const cls = MODES[mode];
  if (!cls) return;
  document.documentElement.classList.toggle(cls, enabled);
  if (mode === 'focus') {
    if (enabled) initReadingRuler();
    else cleanupReadingRuler();
  }
  if (mode === 'screenReader' && enabled) {
    runScreenReaderAid();
  }
}

function findMainContent() {
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '#main-content',
    '#mainContent',
    '#content',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.article-body',
    '.story-body',
    '.page-content',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.length > 200) return el;
  }
  // Fall back to the largest text-containing block not in nav/header/footer
  const candidates = Array.from(document.querySelectorAll('div, section'))
    .filter(el => !el.closest('nav, header, footer, aside'))
    .sort((a, b) => b.innerText.length - a.innerText.length);
  return candidates[0] || document.body;
}


function onRulerMouseMove(e) {
  const ruler = document.getElementById('readeasy-ruler');
  if (ruler) ruler.style.top = e.clientY + 'px';
}

function initReadingRuler() {
  let ruler = document.getElementById('readeasy-ruler');
  if (!ruler) {
    ruler = document.createElement('div');
    ruler.id = 'readeasy-ruler';
    document.body.appendChild(ruler);
  }
  document.addEventListener('mousemove', onRulerMouseMove);
}

function cleanupReadingRuler() {
  document.removeEventListener('mousemove', onRulerMouseMove);
  const ruler = document.getElementById('readeasy-ruler');
  if (ruler) ruler.remove();
}

function detectIssues() {
  const issues = [];

  const missingAlt = document.querySelectorAll('img:not([alt]), img[alt=""]');
  if (missingAlt.length > 0) {
    issues.push({
      type: 'missing-alt',
      severity: 'error',
      message: `${missingAlt.length} image${missingAlt.length > 1 ? 's' : ''} missing alt text`,
    });
  }

  const unlabeled = Array.from(
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea, select')
  ).filter(el => {
    const id = el.id;
    return (
      !el.getAttribute('aria-label') &&
      !el.getAttribute('aria-labelledby') &&
      !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
    );
  });
  if (unlabeled.length > 0) {
    issues.push({
      type: 'missing-labels',
      severity: 'error',
      message: `${unlabeled.length} form field${unlabeled.length > 1 ? 's' : ''} missing labels`,
    });
  }

  const longParas = Array.from(document.querySelectorAll('p')).filter(
    p => p.textContent.trim().length > 600
  );
  if (longParas.length > 0) {
    issues.push({
      type: 'long-paragraphs',
      severity: 'warning',
      message: `${longParas.length} very long paragraph${longParas.length > 1 ? 's' : ''}`,
    });
  }

  const uncaptionedVideos = Array.from(document.querySelectorAll('video')).filter(
    v => !v.querySelector('track[kind="captions"], track[kind="subtitles"]')
  );
  if (uncaptionedVideos.length > 0) {
    issues.push({
      type: 'no-captions',
      severity: 'warning',
      message: `${uncaptionedVideos.length} video${uncaptionedVideos.length > 1 ? 's' : ''} without captions`,
    });
  }

  return issues;
}

async function runScreenReaderAid() {
  const imgs = Array.from(document.querySelectorAll('img:not([alt]), img[alt=""]'))
    .filter(img => img.src && img.src.startsWith('http') && !img.dataset.readeasyAlt)
    .slice(0, 5);

  for (const img of imgs) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_ALT_TEXT',
        imageUrl: img.src,
      });
      if (response?.altText) {
        img.alt = response.altText;
        img.title = `AI: ${response.altText}`;
        img.dataset.readeasyAlt = 'true';
      }
    } catch {
      // skip image if it fails
    }
  }
}

async function simplifyPage() {
  const main = findMainContent();
  const paragraphs = Array.from(main.querySelectorAll('p, li'))
    .filter(el => el.textContent.trim().length > 60)
    .slice(0, 10);

  if (paragraphs.length === 0) {
    return { success: false, error: 'No text content found to simplify.' };
  }

  const texts = paragraphs.map(p => p.textContent.trim());

  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: 'SIMPLIFY_TEXT', texts });
  } catch {
    return { success: false, error: 'Could not reach background service.' };
  }

  if (response?.error) return { success: false, error: response.error };

  if (response?.simplified) {
    paragraphs.forEach((el, i) => {
      if (response.simplified[i]) {
        el.dataset.originalText = el.textContent;
        el.textContent = response.simplified[i];
        el.classList.add('readeasy-simplified');
      }
    });
    return { success: true };
  }

  return { success: false, error: 'No simplified text returned.' };
}

function applyColorPalette(colors) {
  let styleEl = document.getElementById('readeasy-palette');
  if (!colors) {
    if (styleEl) styleEl.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'readeasy-palette';
    document.head.appendChild(styleEl);
  }
  const { bg, text, link } = colors;
  styleEl.textContent = `
    html, body { background-color: ${bg} !important; }
    body, body p, body li, body td, body th,
    body h1, body h2, body h3, body h4, body h5, body h6,
    body span, body label, body blockquote { color: ${text} !important; }
    body a { color: ${link} !important; }
  `;
}

function applyReadingPrefs({ fontSize = 100, lineHeight = 1.5, letterSpacing = 0, wordSpacing = 0 }) {
  const html = document.documentElement;
  document.body.style.zoom = fontSize / 100;
  html.style.setProperty('--re-line-height', lineHeight);
  html.style.setProperty('--re-letter-spacing', letterSpacing + 'px');
  html.style.setProperty('--re-word-spacing', wordSpacing + 'px');
  html.setAttribute('data-re-prefs', '1');
}

let ttsTimer = null;

function keepSynthAlive() {
  if (ttsTimer) clearInterval(ttsTimer);
  ttsTimer = setInterval(() => {
    if (!window.speechSynthesis.speaking || window.speechSynthesis.paused) return;
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
  }, 10000);
}

function startTTS() {
  window.speechSynthesis.cancel();
  const selected = window.getSelection().toString().trim();
  const text = selected || findMainContent().innerText.replace(/\s+/g, ' ').trim();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = stopTTS;
  window.speechSynthesis.speak(utterance);
  keepSynthAlive();
  return true;
}

function pauseTTS() {
  window.speechSynthesis.pause();
  if (ttsTimer) { clearInterval(ttsTimer); ttsTimer = null; }
}

function resumeTTS() {
  window.speechSynthesis.resume();
  keepSynthAlive();
}

function stopTTS() {
  if (ttsTimer) { clearInterval(ttsTimer); ttsTimer = null; }
  window.speechSynthesis.cancel();
}

function restoreOriginal() {
  document.querySelectorAll('.readeasy-simplified').forEach(el => {
    if (el.dataset.originalText) el.textContent = el.dataset.originalText;
    el.classList.remove('readeasy-simplified');
    delete el.dataset.originalText;
  });
}

function getPageContent() {
  const main = findMainContent();
  return main.innerText.replace(/\s+/g, ' ').trim().substring(0, 5000);
}

async function init() {
  try {
    const { activeModes = {}, readingPrefs, colorPalette } = await chrome.storage.local.get(['activeModes', 'readingPrefs', 'colorPalette']);
    for (const [mode, enabled] of Object.entries(activeModes)) {
      if (enabled) setMode(mode, true);
    }
    if (readingPrefs) applyReadingPrefs(readingPrefs);
    if (colorPalette) applyColorPalette(colorPalette);
  } catch {
    // storage unavailable
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_MODE':
      setMode(message.mode, message.enabled);
      sendResponse({ success: true });
      break;

    case 'DETECT_ISSUES':
      sendResponse({ issues: detectIssues() });
      break;

    case 'SIMPLIFY_PAGE':
      simplifyPage().then(sendResponse);
      return true;

    case 'RESTORE_ORIGINAL':
      restoreOriginal();
      sendResponse({ success: true });
      break;

    case 'GET_PAGE_CONTENT':
      sendResponse({ content: getPageContent(), title: document.title });
      break;

    case 'SET_COLOR_PALETTE':
      applyColorPalette(message.colors);
      sendResponse({ success: true });
      break;

    case 'SET_READING_PREFS':
      applyReadingPrefs(message.prefs);
      sendResponse({ success: true });
      break;

    case 'GET_TTS_STATE':
      sendResponse({
        speaking: window.speechSynthesis.speaking,
        paused: window.speechSynthesis.paused,
      });
      break;

    case 'START_TTS':
      sendResponse({ started: startTTS() });
      break;

    case 'PAUSE_TTS':
      pauseTTS();
      sendResponse({ success: true });
      break;

    case 'RESUME_TTS':
      resumeTTS();
      sendResponse({ success: true });
      break;

    case 'STOP_TTS':
      stopTTS();
      sendResponse({ success: true });
      break;

    case 'GET_ACTIVE_MODES': {
      const active = {};
      for (const [mode, cls] of Object.entries(MODES)) {
        active[mode] = document.documentElement.classList.contains(cls);
      }
      sendResponse({ activeModes: active });
      break;
    }
  }
});

init();
