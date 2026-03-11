# Product Requirements Document (PRD)

## Product Name

MarkdStudio

## Product Summary

MarkdStudio is a web-based, serverless Markdown writing studio for technical and long-form content. It combines a strong writing/editor experience with high-quality preview and export workflows.

The app must run as a static website and be hostable on platforms like GitHub Pages.

## Goals

- Deliver fast markdown authoring with immediate visual feedback.
- Support both markdown-first and visual inline editing workflows.
- Provide publish-ready outputs (HTML, PDF, print, markdown).
- Keep setup simple: no backend required.

## Non-Goals

- Real-time multiplayer collaboration.
- User authentication and cloud accounts.
- Complex CMS workflows.

## Target Users

- Developers writing technical documentation.
- Content creators drafting blog posts and guides.
- Students and researchers creating notes with code/math.

## Core User Problems

- Existing editors are either too basic or too heavy.
- Markdown preview often differs from final output.
- Export to polished formats is frequently painful.
- Power users want code-editor productivity while writing markdown.

## Key Features

### 1) Editing Modes

- Split mode (write + preview)
- Write mode (focused markdown editor)
- Preview mode (reading and review)
- Inline mode (visual editing surface with markdown sync)

### 2) Advanced Code Editor

- Markdown syntax highlighting
- Line numbers
- Auto indentation
- Auto closing pairs
- Bracket matching
- Multi-cursor support
- Find and replace (regex support)

### 3) Preview and Rendering

- GitHub-flavored markdown support
- Mermaid diagrams
- KaTeX math
- Code highlighting
- Footnotes, callouts, task lists, tables, and rich markdown blocks

### 4) Theming and Appearance

- Document themes (GitHub, Documentation, Blog, Minimal, Academic)
- Appearance options: Light, Dark, System
- Typography controls: font family, size, line height, max width

### 5) TOC and Navigation

- Dynamic table of contents generated from headings
- TOC panel on right side
- TOC quick toggle on tab bar

### 6) Document and File Handling

- Multi-document tabs
- Open file / upload markdown
- Save to disk and download markdown
- Keep disk-loaded/uploaded documents titled by filename

### 7) Export

- Export HTML
- Export PDF with options:
  - Margin size
  - Orientation (portrait/landscape)
  - Paper format (A4/Letter/Legal)
- Print
- Embed snippet export

### 8) App Menu Drawer

- About page
- Keyboard shortcuts page
- Download skill.md from workspace
- Developer information section (placeholder until details provided)

## UX Requirements

- Clean, responsive layout for desktop and mobile
- Fast interactions and minimal UI lag
- Accessible controls (labels, keyboard-friendly interactions)
- Persistent user settings via local storage

## Technical Requirements

- Pure static app (HTML/CSS/JS)
- Browser storage via IndexedDB/localStorage
- No mandatory backend services
- GitHub Pages compatibility

## SEO Requirements

- Descriptive title and meta description
- Open Graph and Twitter metadata
- Canonical link
- Structured data (SoftwareApplication)
- Indexable static content

## Success Metrics

- Time-to-first-usable-edit under 2 seconds on modern desktop
- Smooth live preview updates while typing
- Reliable export completion for HTML/PDF
- Positive user feedback for editing and navigation ergonomics

## Future Enhancements

- Developer profile section in app drawer once details are provided
- Additional export templates and presets
- Deeper visual editor parity for every markdown extension
