import type { Root, Element } from 'hast';
import { toString as hastToString } from 'hast-util-to-string';

// --- Mermaid: client-side render, same trust model as rehype-github-alert ---
//
// Why a custom plugin instead of the `rehype-mermaid` package: that package
// renders SERVER-SIDE via `mermaid-isomorphic`, which drives a real headless
// browser (Playwright) to typeset diagrams at build/request time. This app
// renders markdown entirely client-side (Preview.svelte calls
// renderMarkdown() directly in a $effect, no server round-trip for user
// content — see render.ts) — there's no server-side step for a headless
// browser to run in, so that package doesn't fit this architecture, same
// structural reason rehype-mathjax's chtml/svg/default modes don't fit
// (see render.ts's Math section for the parallel case).
//
// This plugin does NOT render anything itself. It only finds
// `pre > code.language-mermaid` blocks (remark's standard fenced-code-block
// output — see it produced directly by remark-parse/remark-rehype with no
// plugin involved) and swaps them for a placeholder `<div
// class="mermaid-diagram" data-mermaid-source="...">`. Actual typesetting
// happens in Preview.svelte, which loads the real `mermaid` client runtime
// and calls `mermaid.render()` against each placeholder's decoded source —
// the same split MathJax uses (render.ts wraps delimiters only,
// Preview.svelte does the real typesetting) applied to mermaid's own
// two-phase render API instead of MathJax's typesetPromise.
//
// Placement in the pipeline (see render.ts's ordering comment for the full
// rule): runs AFTER rehypeSanitize, same slot as rehypeGithubAlert, for the
// identical reason. If this ran before sanitize, the schema would need to
// allow-list `div.mermaid-diagram[data-mermaid-source]` so the placeholder
// survives sanitization — but allow-listing that shape means the sanitizer
// can no longer distinguish "the plugin generated this" from "the user
// hand-typed this div via raw HTML" (allowDangerousHtml is true — see
// render.ts). A hand-typed placeholder div is inert on its own (mermaid
// source as inert text isn't dangerous), but it defeats the same
// "only the plugin's own trusted shape survives" property the alert plugin
// relies on, for no benefit — so it runs after sanitize like everything
// else that isn't the sanitizer's own baseline HTML.
//
// The mermaid source goes into a `data-*` attribute rather than as the
// element's text content because it needs to survive as literal text
// through the eventual {@html html} injection in Preview.svelte with no
// risk of the BROWSER's own HTML parser reinterpreting characters in the
// source (mermaid syntax can contain `<`/`>`/quotes — e.g. `-->` arrows,
// subgraph labels) as markup when the string is later read back out via
// `element.dataset.mermaidSource`. Encoding as a data attribute means the
// browser's own attribute-value parsing (which already handles entity
// decoding correctly) does that work, rather than hand-rolling an
// escape/unescape pair.
export function rehypeMermaidPlaceholder() {
	return (tree: Root) => {
		visitAndReplace(tree);
	};
}

function visitAndReplace(node: Root | Element): void {
	if (!('children' in node) || !node.children) return;

	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		if (child.type !== 'element') continue;

		const mermaidCode = getMermaidCodeChild(child);
		if (mermaidCode) {
			const source = hastToString(mermaidCode);
			node.children[i] = {
				type: 'element',
				tagName: 'div',
				properties: {
					className: ['mermaid-diagram'],
					dataMermaidSource: source
				},
				children: []
			} satisfies Element;
			continue; // replaced — no need to recurse into the old subtree
		}

		visitAndReplace(child);
	}
}

// Matches remark's standard fenced-code-block shape: <pre><code
// class="language-mermaid">...</code></pre>. rehype-highlight (which runs
// earlier in the pipeline — see render.ts's ordering comment) also adds an
// `hljs` class to every code block it sees, mermaid's included, since
// nothing registers "mermaid" as a highlight.js language for it to
// tokenize — checked directly (see rehype-mermaid-placeholder test file):
// the class list ends up as `["hljs", "language-mermaid"]`, not just
// `["language-mermaid"]` alone, so this checks for the language class's
// PRESENCE in the list rather than an exact-match, to not depend on
// rehype-highlight's unrelated behavior toward languages it doesn't know.
function getMermaidCodeChild(pre: Element): Element | null {
	if (pre.tagName !== 'pre') return null;
	if (pre.children.length !== 1) return null;

	const code = pre.children[0];
	if (code.type !== 'element' || code.tagName !== 'code') return null;

	const classNames = code.properties?.className;
	const classList = Array.isArray(classNames) ? classNames : [];
	if (!classList.includes('language-mermaid')) return null;

	return code;
}
