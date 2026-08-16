# MarkdStudio

A lightweight markdown editor and live preview app built with SvelteKit. It focuses on GitHub-flavored markdown rendering, local document storage, and a clean split-pane editing experience.

## Features

- Live markdown preview
- GitHub-style markdown rendering, including:
  - tables
  - task lists
  - footnotes
  - blockquotes
  - alerts like `> [!NOTE]`
  - fenced code blocks with syntax highlighting
  - math via MathJax
- Offline-style document persistence using IndexedDB
- Multi-tab document workflow
- Fast local editing experience without a backend
- Static hosting friendly

## Tech stack

- SvelteKit
- Svelte 5
- CodeMirror
- Unified + Remark/Rehype pipeline
- GitHub markdown CSS
- MathJax
- IndexedDB for autosave

## Getting started

### 1) Install dependencies

```bash
npm install
```

### 2) Run the app locally

```bash
npm run dev
```

Then open the local URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Available scripts

```bash
npm run dev
npm run build
npm run preview
npm run check
npm run check:watch
```

### Script meanings

- `npm run dev` — start the local dev server
- `npm run build` — create a production build
- `npm run preview` — preview the production build locally
- `npm run check` — run Svelte type checking
- `npm run check:watch` — watch mode for type checking

## Project structure

```text
.
├── src/
│   ├── app.css
│   ├── app.d.ts
│   ├── app.html
│   ├── lib/
│   │   ├── components/
│   │   ├── db/
│   │   ├── editor/
│   │   ├── markdown/
│   │   └── stores/
│   └── routes/
├── static/
├── docs/
├── assets/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── netlify.toml
├── vercel.json
├── robots.txt
├── sitemap.xml
└── README.md
```

## Notes on rendering

The markdown renderer is intentionally tuned to match GitHub’s real output more closely than a generic CommonMark/GFM baseline. This includes GitHub-style alert callouts and GitHub-like sanitization behavior.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

