const MODES = {
  highContrast: 'readeasy-high-contrast',
  cleanView: 'readeasy-clean-view',
  dyslexia: 'readeasy-dyslexia',
  focus: 'readeasy-focus',
  screenReader: 'readeasy-screen-reader',
};

function setMode(mode, enabled) {
  const cls = MODES[mode];
  if (!cls) return;
  document.documentElement.classList.toggle(cls, enabled);
  if (mode === 'cleanView') {
    if (enabled) initCleanView();
    else cleanupCleanView();
  }
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

let cvObserver = null;

function hideDistractions() {
  document.querySelectorAll('body *').forEach(el => {
    if (el.dataset.readeasyCV !== undefined) return;
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'link', 'meta', 'noscript'].includes(tag)) return;

    const style = window.getComputedStyle(el);
    const isFixed = style.position === 'fixed';
    const zIndex = parseInt(style.zIndex) || 0;

    // Hide high-z-index fixed overlays (popups, banners, cookie notices)
    if (isFixed && zIndex > 99 && !el.closest('header, nav, [role="navigation"], [role="banner"]')) {
      el.dataset.readeasyCV = 'true';
      return;
    }

    // Hide elements with common distraction class/id patterns
    const identifier = (el.getAttribute('class') || '') + ' ' + (el.getAttribute('id') || '');
    if (/popup|modal|overlay|cookie|consent|gdpr|newsletter|subscribe|lightbox|interstitial|chat-widget|chat-bubble|chat-button|floating-btn|sticky-ad|promo-bar/i.test(identifier)) {
      if (!el.closest('main, article, [role="main"]')) {
        el.dataset.readeasyCV = 'true';
      }
    }
  });
}

function initCleanView() {
  hideDistractions();
  // Watch for dynamically injected popups
  cvObserver = new MutationObserver(hideDistractions);
  cvObserver.observe(document.body, { childList: true, subtree: false });
}

function cleanupCleanView() {
  if (cvObserver) { cvObserver.disconnect(); cvObserver = null; }
  document.querySelectorAll('[data-readeasy-cv]').forEach(el => {
    delete el.dataset.readeasyCV;
  });
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

const PALETTE_COLORS = {
  deuteranopia: { bg: '#FEFAE0', text: '#023047', link: '#E07B39' },
  protanopia:   { bg: '#EAF4FB', text: '#1B2A4A', link: '#D4A017' },
  tritanopia:   { bg: '#FFF0F0', text: '#1B4332', link: '#C0392B' },
  monochrome:   { bg: '#FFFFFF', text: '#111111', link: '#444444' },
};

function applyColorPalette(colors, type) {
  const html = document.documentElement;
  if (!colors) {
    html.removeAttribute('data-re-palette');
    html.style.removeProperty('--re-palette-bg');
    html.style.removeProperty('--re-palette-text');
    html.style.removeProperty('--re-palette-link');
    return;
  }
  html.style.setProperty('--re-palette-bg', colors.bg);
  html.style.setProperty('--re-palette-text', colors.text);
  html.style.setProperty('--re-palette-link', colors.link);
  html.setAttribute('data-re-palette', type || 'custom');
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
    const {
      activeModes = {},
      readingPrefs,
      activePalette = 'none',
      customEnabled = false,
      customColors,
    } = await chrome.storage.local.get(['activeModes', 'readingPrefs', 'activePalette', 'customEnabled', 'customColors']);

    for (const [mode, enabled] of Object.entries(activeModes)) {
      if (enabled) setMode(mode, true);
    }
    if (readingPrefs) applyReadingPrefs(readingPrefs);

    let colors = null, type = 'none';
    if (customEnabled) {
      colors = customColors || { bg: '#ffffff', text: '#222222', link: '#222222' };
      type = activePalette !== 'none' ? activePalette : 'custom';
    } else if (activePalette !== 'none') {
      colors = PALETTE_COLORS[activePalette];
      type = activePalette;
    }
    if (colors) applyColorPalette(colors, type);
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
      applyColorPalette(message.colors, message.type);
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
