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
  await chrome.storage.local.set({ preferences, activeModes, aiApiKey: apiKey, onboardingComplete: true });
  chrome.tabs.getCurrent(tab => { if (tab?.id) chrome.tabs.remove(tab.id); });
}

async function saveSettings() {
  const apiKey = document.getElementById('api-key-input').value.trim();
  await chrome.storage.local.set({ aiApiKey: apiKey });
  chrome.tabs.getCurrent(tab => { if (tab?.id) chrome.tabs.remove(tab.id); });
}

document.getElementById('btn-start').addEventListener('click', nextStep);
document.getElementById('btn-back-2').addEventListener('click', prevStep);
document.getElementById('btn-next-2').addEventListener('click', nextStep);
document.getElementById('btn-back-3').addEventListener('click', prevStep);
document.getElementById('btn-next-3').addEventListener('click', isSettingsMode ? saveSettings : nextStep);
document.getElementById('btn-finish').addEventListener('click', finish);

if (isSettingsMode) {
  showStep(3);
  document.querySelector('.progress').classList.add('hidden');
  document.getElementById('btn-back-3').classList.add('hidden');
  document.getElementById('btn-next-3').textContent = 'Save';
  document.querySelector('#step-3 h2').textContent = 'API Key Settings';
} else {
  const PREF_TO_MODE = {
    highContrast: 'readeasy-high-contrast',
    dyslexia: 'readeasy-dyslexia',
  };

  function applyLiveMode(prefValue, enabled) {
    const cls = PREF_TO_MODE[prefValue];
    if (cls) document.documentElement.classList.toggle(cls, enabled);
  }

  document.querySelectorAll('[name="pref"]').forEach(input => {
    input.addEventListener('change', e => applyLiveMode(e.target.value, e.target.checked));
  });
}

chrome.storage.local.get('aiApiKey', ({ aiApiKey }) => {
  if (aiApiKey) document.getElementById('api-key-input').value = aiApiKey;
});
