# MarkdStudio — Document Examples

Complete example documents showing correct Markdown structure for common use cases.

---

## Table of Contents

- [README File](#readme-file)
- [Technical Documentation](#technical-documentation)
- [API Reference Note](#api-reference-note)
- [Meeting Notes](#meeting-notes)
- [Tutorial / Guide](#tutorial--guide)
- [Project Changelog](#project-changelog)
- [Knowledge Base Article](#knowledge-base-article)

---

## README File

````markdown
# ProjectName

A short one-sentence description of what this project does.

## Overview

Longer description — what problem it solves, who it is for, and what makes it useful.

## Features

- Fast and lightweight
- Works offline
- No external dependencies at runtime

## Installation

```bash
npm install projectname
```

## Usage

```js
import ProjectName from 'projectname';

const result = ProjectName.run({ option: true });
console.log(result);
```

## Configuration

| Option     | Type    | Default | Description                  |
| ---------- | ------- | ------- | ---------------------------- |
| `debug`    | boolean | false   | Enable verbose logging       |
| `timeout`  | number  | 5000    | Request timeout in ms        |
| `language` | string  | `"en"`  | Output language code         |

## Contributing

Pull requests are welcome. Open an issue first to discuss major changes.

## License

MIT © 2026 Developer Name
````

---

## Technical Documentation

````markdown
# Authentication Guide

> [!IMPORTANT]
> All API requests require a valid Bearer token.

## Overview

This guide explains how to obtain and use authentication tokens for the API.

## Getting a Token

Send a POST request to `/auth/token` with your credentials.

```bash
curl -X POST https://api.example.com/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "secret"}'
```

**Response:**

```json
{
  "access_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## Using the Token

Include the token in the `Authorization` header:

```bash
curl https://api.example.com/data \
  -H "Authorization: Bearer eyJhbGci..."
```

## Token Expiry

Tokens expire after 1 hour. Use the `/auth/refresh` endpoint to get a new one.

> [!TIP]
> Store tokens securely. Never log or expose tokens in client-side code.

## Error Responses

| Status | Meaning              | Action                    |
| ------ | -------------------- | ------------------------- |
| 401    | Token missing        | Add Authorization header  |
| 403    | Token invalid/expired| Refresh or re-authenticate|
| 429    | Rate limit reached   | Wait and retry            |
````

---

## API Reference Note

````markdown
# User Endpoints

Base URL: `https://api.example.com/v1`

---

## GET /users

Returns a list of users.

**Query parameters:**

| Param    | Type   | Required | Description         |
| -------- | ------ | -------- | ------------------- |
| `limit`  | number | No       | Max results (1–100) |
| `offset` | number | No       | Pagination offset   |

**Example request:**

```bash
curl https://api.example.com/v1/users?limit=10
```

**Example response:**

```json
{
  "data": [
    { "id": "u1", "name": "Alice", "email": "alice@example.com" },
    { "id": "u2", "name": "Bob",   "email": "bob@example.com" }
  ],
  "total": 2
}
```

---

## POST /users

Creates a new user.

**Request body:**

```json
{
  "name": "Carol",
  "email": "carol@example.com",
  "role": "editor"
}
```

**Response:** `201 Created` with the new user object.

> [!WARNING]
> Email addresses must be unique. Duplicate emails return `409 Conflict`.
````

---

## Meeting Notes

````markdown
# Team Sync — 2026-03-11

**Attendees:** Alice, Bob, Carol, Dave
**Facilitator:** Alice

---

## Agenda

1. Sprint review
2. Blockers and decisions
3. Next sprint planning

---

## Sprint Review

- Shipped feature: dark mode toggle :white_check_mark:
- Shipped feature: PDF export with options :white_check_mark:
- Delayed: mobile layout — needs design revision

**Velocity:** 34 points (target was 38)

---

## Blockers

- Bob: waiting on API credentials from DevOps — **ETA Friday**
- Carol: design review outstanding for onboarding screens

---

## Decisions

- Use `html2pdf.js` for PDF export (approved)
- Defer developer portfolio section — Carol to provide content by end of week
- Next sprint start: 2026-03-16

---

## Action Items

- [ ] Bob — follow up with DevOps on API credentials (@Bob, due 2026-03-14)
- [ ] Carol — send portfolio copy (@Carol, due 2026-03-14)
- [ ] Alice — update sprint board with new tickets (@Alice, due 2026-03-12)
- [x] Dave — deploy hotfix to production (done)

---

## Next Meeting

2026-03-18, 10:00 AM UTC
````

---

## Tutorial / Guide

````markdown
# Getting Started with MarkdStudio

Welcome to MarkdStudio — a browser-based Markdown editor with live preview and
extended syntax support.

---

## Step 1 — Open the Editor

Navigate to MarkdStudio in your browser. The editor opens with a welcome document.

You will see three panels:

| Panel    | Purpose                        |
| -------- | ------------------------------ |
| Editor   | Write and edit Markdown source |
| Preview  | Live rendered HTML preview     |
| TOC      | Auto-generated table of contents |

---

## Step 2 — Write Your First Document

Click the editor panel and start typing. Markdown renders live in the preview.

Try a basic structure:

```markdown
# My First Document

## Introduction

This is a paragraph. **Bold text** and *italic text* work as expected.

## Code Example

```js
console.log("Hello, MarkdStudio!");
```
```

> [!TIP]
> Press <kbd>Ctrl+S</kbd> to save. Press <kbd>Ctrl+P</kbd> to open find/replace.

---

## Step 3 — Switch Modes

Use the mode tabs at the top to switch between:

- **Write** — full-screen editor only
- **Split** — editor and preview side by side
- **Preview** — rendered preview only

---

## Step 4 — Export Your Document

Open the export menu to download your document as:

- **Markdown** — portable `.md` file
- **HTML** — rendered standalone page
- **PDF** — formatted PDF with margin/orientation options

---

## Keyboard Shortcuts

| Shortcut | Action |
| -------- | ------ |
| <kbd>Ctrl+N</kbd> | New document |
| <kbd>Ctrl+O</kbd> | Open file |
| <kbd>Ctrl+S</kbd> | Save document |
| <kbd>Ctrl+P</kbd> | Find and replace |
| <kbd>Ctrl+B</kbd> | Bold selected text |
| <kbd>Ctrl+I</kbd> | Italic selected text |

---

## Next Steps

- [x] Open MarkdStudio
- [x] Write a document
- [ ] Try a Mermaid diagram
- [ ] Export to PDF
````

---

## Project Changelog

````markdown
# Changelog

All notable changes to MarkdStudio are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Planned

- Mobile layout improvements
- Developer portfolio section in About drawer

---

## [1.2.0] — 2026-03-11

### Added

- Real PDF export using html2pdf.js with margin, orientation, and paper size options
- TOC toggle button in the tab bar (right side)
- App menu drawer with About, Shortcuts, and skill.md download
- Full keyboard shortcut listing in the Shortcuts drawer page
- SEO meta tags, Open Graph, Twitter card, and JSON-LD structured data

### Changed

- App renamed from Markdown Studio to MarkdStudio throughout
- TOC panel moved to the right side of the layout
- Welcome document rewritten for MarkdStudio branding
- skill.md, PRD.md, and README.md rewritten

### Fixed

- File title now uses the filename (not first heading) for disk-opened files
- skill.md download now uses fetch+blob with a fallback link

---

## [1.1.0] — 2026-02-15

### Added

- CodeMirror 5 editor with Markdown syntax highlighting
- Line numbers and active line indicator
- Auto-closing pairs (brackets, quotes)
- Bracket matching
- Multi-cursor editing
- Find and replace panel (<kbd>Ctrl+P</kbd>)

### Changed

- Replaced plain textarea with CodeMirror editor
````

---

## Knowledge Base Article

````markdown
# How to Export a PDF in MarkdStudio

**Category:** Export and Download
**Last updated:** 2026-03-11

---

## Overview

MarkdStudio can export your document as a PDF file, generated directly in the browser.
You can choose margin size, page orientation, and paper format before downloading.

---

## Steps

1. Open the document you want to export.
2. Click the **Export** menu in the toolbar.
3. Select **Export as PDF**.
4. When prompted:
   - Enter a **margin size** in mm (default: `12`)
   - Choose **orientation**: `portrait` or `landscape`
   - Choose **paper size**: `a4`, `letter`, or `legal`
5. The PDF downloads automatically.

> [!NOTE]
> The export uses the rendered HTML preview. Make sure the preview looks correct
> before exporting.

---

## Tips

> [!TIP]
> Use **landscape** orientation for wide tables or diagrams.

> [!TIP]
> Increase the margin (e.g., `20mm`) when printing for binding.

---

## Known Limitations

- Very wide tables may overflow the page boundary.
- Mermaid diagrams are rendered as images in the PDF.
- Custom CSS themes may not apply to the exported PDF.

---

## Related

- [Keyboard Shortcuts](skill.md) — Open the shortcuts drawer for quick reference
- [Export as HTML](skill.md) — For a standalone web page export
````
