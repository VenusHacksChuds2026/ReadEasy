const isSettingsMode = new URLSearchParams(location.search).get('mode') === 'settings';
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

function buildActiveModes(preferences) {
  return {
    focus:        !!preferences.simpleLanguage,
    cleanView:    !!preferences.noClutter,
    highContrast: !!preferences.highContrast,
    dyslexia:     !!preferences.dyslexia,
    screenReader: !!preferences.screenReader,
  };
}

function collectPreferences() {
  const preferences = {};
  document.querySelectorAll('[name="pref"]:checked').forEach(el => {
    preferences[el.value] = true;
  });
  return preferences;
}

async function finish() {
  const preferences = collectPreferences();
  const activeModes = buildActiveModes(preferences);
  const apiKey = document.getElementById('api-key-input').value.trim();
  await chrome.storage.local.set({ preferences, activeModes, aiApiKey: apiKey, onboardingComplete: true });
  chrome.tabs.getCurrent(tab => { if (tab?.id) chrome.tabs.remove(tab.id); });
}

async function saveSettings() {
  const preferences = collectPreferences();
  const activeModes = buildActiveModes(preferences);
  const apiKey = document.getElementById('api-key-input').value.trim();
  await chrome.storage.local.set({ preferences, activeModes, aiApiKey: apiKey });
  chrome.tabs.getCurrent(tab => { if (tab?.id) chrome.tabs.remove(tab.id); });
}

document.getElementById('btn-start').addEventListener('click', nextStep);
document.getElementById('btn-back-2').addEventListener('click', prevStep);
document.getElementById('btn-next-2').addEventListener('click', nextStep);
document.getElementById('btn-back-3').addEventListener('click', prevStep);
document.getElementById('btn-next-3').addEventListener('click', isSettingsMode ? saveSettings : nextStep);
document.getElementById('btn-finish').addEventListener('click', finish);

// Live mode preview on the onboarding page itself (first-run only)
if (!isSettingsMode) {
  const PREF_TO_MODE = {
    highContrast: 'readeasy-high-contrast',
    dyslexia: 'readeasy-dyslexia',
  };
  document.querySelectorAll('[name="pref"]').forEach(input => {
    input.addEventListener('change', e => {
      const cls = PREF_TO_MODE[e.target.value];
      if (cls) document.documentElement.classList.toggle(cls, e.target.checked);
    });
  });
}

// Settings mode: start on preferences step, hide progress/back, rename button
if (isSettingsMode) {
  showStep(2);
  document.querySelector('.progress').classList.add('hidden');
  document.getElementById('btn-back-2').classList.add('hidden');
  document.getElementById('btn-next-3').textContent = 'Save';
  document.querySelector('#step-3 h2').textContent = 'API Key Settings';
}

// Pre-fill saved values
chrome.storage.local.get(['aiApiKey', 'preferences'], ({ aiApiKey, preferences = {} }) => {
  if (aiApiKey) document.getElementById('api-key-input').value = aiApiKey;
  for (const [key, val] of Object.entries(preferences)) {
    const el = document.querySelector(`[name="pref"][value="${key}"]`);
    if (el && val) el.checked = true;
  }
});
