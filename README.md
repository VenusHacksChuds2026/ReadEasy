# ReadEasy

A Chrome extension that makes any website more accessible for users with visual impairments, dyslexia, ADHD, and other accessibility needs.

## Features

- **Reading Mode** — Strips clutter, centers content, improves typography
- **High Contrast Mode** — Dark background with white text and yellow links
- **Dyslexia-Friendly Mode** — Readable fonts, wider letter/word spacing, left-aligned text
- **Focus Mode** — Removes cookie banners, popups, ads, and animations
- **Screen Reader Aid** — AI-generates alt text for images missing descriptions
- **AI Simplify** — Rewrites complex paragraphs in plain language (grade 8 level)
- **AI Summarize** — Summarizes any page into key bullet points

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked** and select the `app/` folder
4. The ReadEasy icon appears in your toolbar

On first install, the onboarding page opens automatically. Add your Groq API key there to enable AI features.

## Getting a Groq API Key

Visit [console.groq.com/keys](https://console.groq.com/keys) to get a free API key.

## Usage

Click the ReadEasy icon in the Chrome toolbar to open the panel. Toggle any mode on/off — settings persist across pages. Use the AI buttons to simplify or summarize the current page.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript, HTML, CSS (no build step)
- Groq API (Llama 3.3 for text, Llama 3.2 Vision for images)
- `chrome.storage.local` for persisting preferences
