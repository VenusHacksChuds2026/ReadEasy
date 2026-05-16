const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'llama-3.2-11b-vision-preview';

async function callGroq(apiKey, messages, model = TEXT_MODEL, maxTokens = 2048) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return {
    base64: btoa(binary),
    mimeType: res.headers.get('content-type')?.split(';')[0] || 'image/jpeg',
  };
}

async function generateAltText(apiKey, imageUrl) {
  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
  const text = await callGroq(apiKey, [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      { type: 'text', text: 'Generate a concise, descriptive alt text for this image in under 125 characters. Describe what the image shows. Do not start with "image of" or "picture of".' },
    ],
  }], VISION_MODEL);
  return text?.trim() || null;
}

async function simplifyTexts(apiKey, texts) {
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n\n');
  const text = await callGroq(apiKey, [{
    role: 'user',
    content: `Rewrite each of the following paragraphs in simple, clear language at a grade 8 reading level. Keep the same meaning. Return ONLY the rewritten paragraphs numbered the same way:\n\n${numbered}`,
  }]);
  if (!text) return null;

  const results = new Array(texts.length).fill('');
  for (const line of text.split('\n')) {
    const match = line.match(/^(\d+)[.)]\s*(.+)/);
    if (match) {
      const idx = parseInt(match[1]) - 1;
      if (idx >= 0 && idx < texts.length) results[idx] = match[2].trim();
    }
  }
  return results;
}

async function summarizePage(apiKey, content, title) {
  const text = await callGroq(apiKey, [{
    role: 'user',
    content: `Summarize this webpage "${title}" in clear, simple bullet points. Include the main topic, key information, any required actions or deadlines, and important warnings. Be concise:\n\n${content}`,
  }], TEXT_MODEL, 512);
  return text?.trim() || null;
}

async function handleMessage(message) {
  const { aiApiKey } = await chrome.storage.local.get('aiApiKey');

  if (!aiApiKey) {
    return { error: 'No API key configured. Open ReadEasy settings to add your Groq API key.' };
  }

  switch (message.type) {
    case 'GENERATE_ALT_TEXT':
      try { return { altText: await generateAltText(aiApiKey, message.imageUrl) }; }
      catch (e) { return { error: e.message }; }

    case 'SIMPLIFY_TEXT':
      try { return { simplified: await simplifyTexts(aiApiKey, message.texts) }; }
      catch (e) { return { error: e.message }; }

    case 'SUMMARIZE_PAGE':
      try { return { summary: await summarizePage(aiApiKey, message.content, message.title) }; }
      catch (e) { return { error: e.message }; }

    default:
      return { error: 'Unknown message type' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});
