# MarkdStudio

MarkdStudio is a modern, serverless Markdown editor focused on fast writing, high-quality preview, and practical export workflows.

## Highlights

- Live Markdown preview with elegant typography
- Multiple document themes and light/dark/system appearance
- Write, Split, Preview, and Inline visual editing modes
- Code editor capabilities powered by CodeMirror:
  - Syntax highlighting
  - Line numbers
  - Bracket matching and auto-closing pairs
  - Find and replace (regex support)
  - Multi-cursor support
- Advanced markdown rendering:
  - Mermaid diagrams
  - KaTeX math
  - Callouts
  - Footnotes
  - Emoji shortcodes
- Export options:
  - HTML
  - PDF (with margin/orientation/paper options)
  - Print
  - Embeddable HTML snippet

## Tech Stack

- Plain HTML, CSS, JavaScript
- marked.js
- highlight.js
- DOMPurify
- KaTeX
- Mermaid
- CodeMirror 5
- html2pdf.js

## Project Structure

- app.js: Main application logic
- styles.css: Application styles
- index.html: UI shell and CDN dependencies
- skill.md: Skill file for content generation rules
- PRD.md: Product requirements document

## Running Locally

1. Open the project with a static server (recommended).
2. Open index.html in your browser.

Notes:
- Most features work directly in static hosting (for example GitHub Pages).
- Some browser APIs (file handling behavior) vary by browser and local file mode.

## Keyboard Shortcuts (Core)

Global:
- Ctrl/Cmd+S: Save to disk
- Ctrl/Cmd+O: Open file
- Ctrl/Cmd+N: New document

Code editor:
- Ctrl/Cmd+F: Find
- Ctrl+H: Replace
- Cmd+Alt+F: Replace (macOS)
- Ctrl/Cmd+G: Next match
- Shift+Ctrl/Cmd+G: Previous match
- Ctrl/Cmd+/: Toggle comment
- Tab: Indent
- Shift+Tab: Outdent

Markdown formatting:
- Ctrl/Cmd+B: Bold
- Ctrl/Cmd+I: Italic
- Ctrl/Cmd+K: Link
- Ctrl/Cmd+`: Inline code
- Ctrl/Cmd+~: Strikethrough
- Ctrl/Cmd+': Blockquote

Inline visual editor:
- Ctrl/Cmd+B: Bold
- Ctrl/Cmd+I: Italic
- Ctrl/Cmd+K: Link
- Ctrl/Cmd+Shift+7: Numbered list
- Ctrl/Cmd+Shift+8: Bulleted list

## Roadmap

- Developer information section (to be added once details are provided)
- Additional inline editor feature parity with full markdown capabilities
- More export customization templates

## License

Use and modify freely for personal and commercial workflows.
