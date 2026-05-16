let currentStep = 1;
const totalSteps = 4;

function showStep(n) {
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
  document.querySelectorAll('.dot').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
  currentStep = n;
}

function nextStep() {
  if (currentStep < totalSteps) showStep(currentStep + 1);
}

function prevStep() {
  if (currentStep > 1) showStep(currentStep - 1);
}

async function finish() {
  const preferences = {};
  document.querySelectorAll('[name="pref"]:checked').forEach(el => {
    preferences[el.value] = true;
  });

  const activeModes = {
    reading: preferences.simpleLanguage || false,
    highContrast: preferences.highContrast || false,
    focus: preferences.noClutter || false,
    dyslexia: preferences.dyslexia || false,
    screenReader: preferences.screenReader || false,
  };

  const apiKey = document.getElementById('api-key-input').value.trim();

  await chrome.storage.local.set({
    preferences,
    activeModes,
    aiApiKey: apiKey,
    onboardingComplete: true,
  });

  // Close this tab
  chrome.tabs.getCurrent(tab => {
    if (tab?.id) chrome.tabs.remove(tab.id);
  });
}

// Button event listeners (inline onclick is blocked by extension CSP)
document.getElementById('btn-start').addEventListener('click', nextStep);
document.getElementById('btn-back-2').addEventListener('click', prevStep);
document.getElementById('btn-next-2').addEventListener('click', nextStep);
document.getElementById('btn-back-3').addEventListener('click', prevStep);
document.getElementById('btn-next-3').addEventListener('click', nextStep);
document.getElementById('btn-finish').addEventListener('click', finish);

const PREF_TO_MODE = {
  highContrast: 'readeasy-high-contrast',
  dyslexia: 'readeasy-dyslexia',
};

function applyLiveMode(prefValue, enabled) {
  const cls = PREF_TO_MODE[prefValue];
  if (cls) document.documentElement.classList.toggle(cls, enabled);
}

// Toggle modes live as checkboxes change
document.querySelectorAll('[name="pref"]').forEach(input => {
  input.addEventListener('change', e => {
    applyLiveMode(e.target.value, e.target.checked);
  });
});

// Pre-fill API key if already saved
chrome.storage.local.get('aiApiKey', ({ aiApiKey }) => {
  if (aiApiKey) {
    document.getElementById('api-key-input').value = aiApiKey;
  }
});

// Pre-fill preferences if returning to settings, and re-apply live modes
chrome.storage.local.get('preferences', ({ preferences = {} }) => {
  for (const [key, val] of Object.entries(preferences)) {
    const el = document.querySelector(`[name="pref"][value="${key}"]`);
    if (el && val) {
      el.checked = true;
      applyLiveMode(key, true);
    }
  }
});
