# CLAUDE.md

## Task

Your task is to write the code for a project made for the VenusHacks 2026 hackathon. This repository was just initialized, so there is no underlying tech stack that you have to worry about.

Once the project is set up, update or create new files in this folder with:
- Build, run, test, and lint commands
- High-level architecture overview
- Key data flows and component relationships

Our idea for the project and it's functionality is located in the [idea.md](idea.md) file. Make sure to create all extension data in the [app](app/) folder.

## Commands

No build step required. This is a Chrome extension loaded directly into the browser.

**Install/run:**
1. Go to `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" → select the `app/` folder

**Reload after changes:** Click the refresh icon on the extension card at `chrome://extensions`

**Lint:** No linter configured. Follow the existing code style.

---

## Architecture

```
app/
├── manifest.json           # Extension config (Manifest V3)
├── icons/icon.svg          # Extension icon
├── popup/                  # Toolbar popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/                # Injected into every webpage
│   ├── content.js          # Mode toggling, page scanning, AI calls
│   └── content.css         # CSS transformations for each mode
├── background/             # Service worker
│   └── service-worker.js   # Gemini API calls, onInstalled handler
└── onboarding/             # First-run and settings page
    ├── onboarding.html
    ├── onboarding.css
    └── onboarding.js
```

## Key Data Flows

**Mode Toggle:**
popup.js → `chrome.storage.local` (save) → `chrome.tabs.sendMessage` → content.js toggles class on `<html>` → content.css applies styles

**AI Summarize:**
popup.js → `GET_PAGE_CONTENT` → content.js → popup.js → `SUMMARIZE_PAGE` → service-worker.js → Gemini API → popup displays result

**AI Simplify:**
popup.js → `SIMPLIFY_PAGE` → content.js → `SIMPLIFY_TEXT` → service-worker.js → Gemini API → content.js replaces paragraph text

**Alt Text Generation:**
content.js (on screenReader mode enable) → `GENERATE_ALT_TEXT` per image → service-worker.js fetches image + calls Gemini vision → content.js sets `img.alt`

**Persistence:** `chrome.storage.local` stores `activeModes`, `preferences`, `geminiApiKey`, `onboardingComplete`.

---

## Development Philosophy

- **Simplicity**: Write simple, straightforward code
- **Readability**: Make code easy to understand
- **Performance**: Consider performance without sacrificing readability
- **Maintainability**: Write code that's easy to update
- **Testability**: Ensure code is testable
- **Reusability**: Create reusable components and functions
- **Less Code = Less Debt**: Minimize code footprint