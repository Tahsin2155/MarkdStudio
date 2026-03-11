# MarkdStudio

MarkdStudio is a static, serverless Markdown writing studio built for fast drafting, polished preview, and practical export workflows.

## What You Get

- Four editing modes: `Split`, `Write`, `Preview`, and `Inline`.
- Code-editor workflow in write mode via CodeMirror 5:
  - Syntax highlighting
  - Line numbers
  - Bracket matching and auto-close
  - Find/replace with regex support
  - Multi-cursor support
- Rich Markdown rendering:
  - Mermaid diagrams
  - KaTeX math
  - Callouts
  - Footnotes
  - Task lists, tables, and emoji shortcodes
- Multi-document tabs with unsaved-change indicators.
- Dynamic Table of Contents with heading tracking.
- Export options:
  - HTML
  - PDF (margin, orientation, paper format)
  - Print
  - Embed HTML snippet
  - Markdown download

## Tech Stack

- HTML, CSS, and vanilla JavaScript
- marked.js
- highlight.js
- DOMPurify
- KaTeX
- Mermaid
- CodeMirror 5
- html2pdf.js

## Project Files

- `index.html` - App shell and CDN dependency includes
- `styles.css` - App styling and theme rules
- `app.js` - Core app logic (editor, preview, TOC, tabs, export)
- `PRD.md` - Product requirements
- `REFERENCE.md` - Markdown syntax reference
- `EXAMPLES.md` - Ready-to-use content examples
- `TEMPLATES.md` - Reusable writing templates


## Keyboard Shortcuts

Global:

- `Ctrl/Cmd+S` Save to disk
- `Ctrl/Cmd+O` Open file
- `Ctrl/Cmd+N` New document

Code editor:

- `Ctrl/Cmd+F` Find
- `Ctrl+H` Replace
- `Cmd+Alt+F` Replace (macOS)
- `Ctrl/Cmd+G` Next match
- `Shift+Ctrl/Cmd+G` Previous match
- `Ctrl/Cmd+/` Toggle comment

Formatting:

- `Ctrl/Cmd+B` Bold
- `Ctrl/Cmd+I` Italic
- `Ctrl/Cmd+K` Link

## Documentation

- See `PRD.md` for product scope and requirements.
- See `REFERENCE.md` for supported Markdown syntax.
- See `EXAMPLES.md` for sample documents.
- See `TEMPLATES.md` for reusable structures.

## Notes

- MarkdStudio is designed to run on static hosting (including GitHub Pages).
- File handling behavior can vary slightly by browser and security context.

## License

See `LICENSE`.
