# Project Idea
Our idea for our project is to create a web extension that reformats websites so that it's easier for users to read. This would be mainly aimed for users with a reading disabilities like:
* visual impairments
* dyslexia
* ADHD
* hearing differences
* low digital literacy
* language barriers
* sensory sensitivity 

## How It Would Work

### 1. User Opens a Website

The user visits any website as usual.

Example:
A student opens a complicated university financial aid page.

The extension scans the page and detects:

* low contrast text
* cluttered layout
* missing image descriptions
* long paragraphs
* videos without captions
* confusing navigation

---

### 2. User Chooses an Accessibility Mode

The extension has quick-toggle modes, such as:

#### Reading Mode

Simplifies the page by:

* removing clutter
* increasing spacing
* making paragraphs shorter
* highlighting key information

#### High Contrast Mode

Improves visibility by:

* darkening text
* lightening backgrounds
* increasing color contrast
* making buttons more obvious

#### Dyslexia-Friendly Mode

Changes the page by:

* using dyslexia-friendly fonts
* increasing line spacing
* avoiding dense text blocks
* reducing visual crowding

#### Focus Mode

Helps users with ADHD or sensory overload by:

* hiding pop-ups
* reducing animations
* highlighting the main content
* breaking content into sections

#### Screen Reader Helper Mode

Improves accessibility by:

* generating missing alt text
* labeling buttons
* summarizing confusing links
* identifying page structure

---

## AI-Powered Features
To create these AI features, we would like to use Google Gemini since we already have an API key for it.
### 1. AI Alt Text Generator

If an image has no alt text, AI generates a short description.

Example:

Original image:
No description.

AI-generated alt text:
“Photo of a student using a laptop in a classroom.”

Why this matters:
Screen reader users can understand images that would otherwise be invisible to them.

---

### 2. AI Page Simplifier

The extension rewrites complex text into simpler language.

Example:

Original:
“Applicants must submit all required documentation prior to the stated deadline to ensure eligibility determination.”

Simplified:
“Turn in all required documents before the deadline so your application can be reviewed.”

This helps:

* ESL users
* first-generation students
* people with reading difficulties
* users navigating complex systems

---

### 3. AI Summary Button

The user can click:

> “Summarize this page”

The extension gives:

* main points
* deadlines
* required actions
* important warnings

Example output:
“Main takeaway: You need to submit FAFSA, upload income documents, and check your aid portal by June 1.”

---

### 4. Personalized Accessibility Profile

When users first install it, they can choose preferences:

“I prefer simple language.”

“I need high contrast.”

“I get overwhelmed by clutter.”

“I use a screen reader.”

“I prefer larger text.”

Then the extension automatically adjusts websites based on those needs.

---

## Basic User Flow

1. User installs extension.
2. User selects accessibility preferences.
3. User visits a website.
4. Extension scans the page.
5. Extension flags accessibility issues.
6. User turns on one or more modes.
7. Website is transformed in real time.
8. User can save preferences for future sites.

---

# Possible Tech Stack
We've also created a possible tech stack for this extension, but feel free to make any changes if you believe that some technologies would work better than what's listed. 

## Frontend

* JavaScript
* HTML/CSS
* Chrome Extension API

## AI Features

* OpenAI API or Gemini API
* Prompting for text simplification and image descriptions

## Optional

* React for popup UI
* Local storage for user preferences
* Web Speech API for read-aloud mode