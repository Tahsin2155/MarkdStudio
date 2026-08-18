<script lang="ts">
	import { renderMarkdown } from '$lib/markdown/render';

	// --- MathJax client runtime ---
	// render.ts wraps math source in \(...\)/\[...\] delimiters via
	// rehype-mathjax/browser but does no actual rendering (see render.ts for
	// why: rehype-mathjax's other modes are Node-only and crash in a real
	// browser — confirmed by reproducing the crash directly, not assumed).
	// This is the other half: load MathJax's real client runtime once, then
	// ask it to typeset the delimited text after each preview update.
	//
	// tex-svg.js is MathJax's own prebuilt browser component (TeX input,
	// SVG output) — a plain self-executing script, not an ES module, so it's
	// loaded via a real <script> tag rather than `import`. Served from
	// /vendor/mathjax-tex-svg.js as a static asset (see vite.config.ts: a
	// small plugin copies it from node_modules/mathjax at build/dev-server
	// start, rather than committing a ~1.8MB vendored file to the repo).
	//
	// SVG output, not CHTML: sidesteps the CDN-font-dependency tradeoff
	// entirely rather than accepting it — the earlier CHTML attempt traded
	// bundle size for a font CDN dependency, but that whole approach turned
	// out to be a dead end anyway (Node-only), and now that the real
	// runtime has to be loaded as a dedicated script regardless, there's no
	// reason to still take on the CDN dependency. SVG output has none.
	let mathJaxLoadPromise: Promise<void> | null = null;
	function loadMathJax(): Promise<void> {
		if (mathJaxLoadPromise) return mathJaxLoadPromise;
		mathJaxLoadPromise = new Promise((resolve, reject) => {
			if (window.MathJax?.typesetPromise) {
				resolve();
				return;
			}
			const script = document.createElement('script');
			script.src = '/vendor/mathjax-tex-svg.js';
			script.async = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Failed to load MathJax'));
			document.head.appendChild(script);
		});
		return mathJaxLoadPromise;
	}

	// --- Mermaid client runtime ---
	// render.ts (via rehype-mermaid-placeholder.ts — see its header comment
	// for the full architecture writeup) turns each ```mermaid fence into a
	// `<div class="mermaid-diagram" data-mermaid-source="...">` placeholder
	// but does no rendering itself. This is the other half: load the real
	// `mermaid` client runtime once, then call its two-phase render API
	// (parse text -> SVG string, by hand-supplied unique id) against each
	// placeholder found in the preview.
	//
	// Unlike MathJax, `mermaid` ships a real ESM build (confirmed via `npm
	// view mermaid exports` — `dist/mermaid.core.mjs`), so it's loaded via a
	// normal dynamic `import()` rather than a manually-vendored <script> tag
	// + static-asset-copy plugin (compare loadMathJax below and
	// vite.config.ts's copyMathJaxVendorFiles) — there's no CJS/global-script
	// packaging problem here to work around, so no reason to take on that
	// extra machinery just to match MathJax's approach for its own sake.
	//
	// Still lazy-loaded on first actual use, same reasoning as MathJax:
	// most documents have no diagrams, and mermaid's parser+renderer is a
	// non-trivial bundle to pull in for documents that never need it.
	let mermaidLoadPromise: Promise<typeof import('mermaid').default> | null = null;
	function loadMermaid(): Promise<typeof import('mermaid').default> {
		if (!mermaidLoadPromise) {
			mermaidLoadPromise = import('mermaid').then((mod) => {
				const mermaid = mod.default;
				// startOnLoad defaults to true, which makes mermaid scan the
				// whole document for `.mermaid`-classed elements on its own,
				// independent of the render calls below — turning it off
				// keeps this app's explicit per-placeholder render() calls as
				// the only path diagrams get typeset through, avoiding a
				// second, uncoordinated render pass racing the one this
				// component already drives (and, in dark mode, drawing with
				// mermaid's default theme instead of the explicit `theme`
				// passed in initialize() below).
				mermaid.initialize({ startOnLoad: false, theme: 'default' });
				return mermaid;
			});
		}
		return mermaidLoadPromise;
	}

	// Each render pass needs IDs that are (a) unique per placeholder within
	// the pass, so concurrent diagrams in one document don't collide inside
	// mermaid's internal temp-DOM handling, and (b) unique ACROSS passes, so
	// a still-in-flight render from a stale pass can't finish late and
	// collide with a new pass's id for what's now a different diagram at
	// that same DOM position. A per-component monotonic counter satisfies
	// both without needing to derive anything from diagram content (content-
	// derived ids would collide whenever two diagrams in the same document
	// happen to be textually identical).
	let mermaidRenderCounter = 0;

	let { source }: { source: string } = $props();

	let html = $state('');
	let renderError = $state<string | null>(null);
	let renderToken = 0;
	let previewEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		const src = source;
		const token = ++renderToken;
		renderMarkdown(src)
			.then((result) => {
				// guard against out-of-order resolution when typing fast
				if (token !== renderToken) return;
				html = result;
				renderError = null;
			})
			.catch((err: unknown) => {
				if (token !== renderToken) return;
				// Deliberately don't blank `html` here — keep showing the last
				// successful render underneath the notice. A stale-but-readable
				// preview is more useful while the user fixes whatever caused
				// this than an empty pane would be, and it avoids a failed
				// render on every keystroke flickering the whole preview to
				// blank and back as the user keeps typing.
				renderError = err instanceof Error ? err.message : String(err);
				console.error('Markdown render failed:', err);
			});
	});

	// Runs after `html` changes and Svelte has applied it to the DOM via
	// {@html html} below (a separate $effect from the one above, so it
	// reruns on `html`/`previewEl` changes specifically, after the DOM
	// mutation those trigger — not on every `source` keystroke directly,
	// since typesetting only needs to happen once the new HTML is actually
	// in place). Only loads/runs MathJax when the rendered output actually
	// contains a MathJax delimiter — most documents have no math at all,
	// and loading a ~1.8MB script for those would be pure waste.
	//
	// Debounced at 400ms (matching the autosave debounce elsewhere in this
	// app, rather than introducing a new, unrelated timing convention).
	// Confirmed by direct instrumentation during review that this is
	// necessary, not just precautionary: MathJax.typesetPromise re-scans
	// and re-renders the ENTIRE preview element on every call, including
	// math that hasn't changed since the last typeset — there's no diffing
	// against what's already rendered. Without debouncing, every keystroke
	// in a document that contains math re-triggers a full typeset pass
	// over that document's whole preview, even when the keystroke was
	// nowhere near any math (confirmed: 14 unrelated keystrokes produced
	// 14 separate full-preview typeset calls). Debouncing doesn't make
	// each call scoped or incremental — it still re-typesets everything —
	// but it collapses the calls during active typing down to one, after
	// typing actually pauses, instead of one per keystroke.
	let typesetDebounceTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const el = previewEl;
		const currentHtml = html;
		if (!el) return;
		if (!currentHtml.includes('\\(') && !currentHtml.includes('\\[')) return;

		clearTimeout(typesetDebounceTimer);
		let cancelled = false;
		typesetDebounceTimer = setTimeout(() => {
			loadMathJax()
				.then(() => window.MathJax?.typesetPromise?.([el]))
				.catch((err: unknown) => {
					if (cancelled) return;
					console.error('MathJax typeset failed:', err);
				});
		}, 400);
		return () => {
			cancelled = true;
			clearTimeout(typesetDebounceTimer);
		};
	});

	// Same shape as the MathJax typeset effect above (separate effect keyed
	// off `html`/`previewEl`, same 400ms debounce matching the app's
	// autosave convention, same "only load the runtime if the rendered
	// output actually needs it" guard) — kept as its own effect rather than
	// merged into the MathJax one specifically so the two runtimes' load-
	// and-render work stays independently cancellable/debounced; a document
	// with only math shouldn't wait on mermaid's bundle loading, and vice
	// versa.
	//
	// Unlike MathJax's typesetPromise (which re-scans and re-renders the
	// ENTIRE preview element every call, confirmed by direct
	// instrumentation — see the comment above), mermaid.render() is called
	// per-placeholder, one at a time, driven by this component walking
	// `previewEl.querySelectorAll('.mermaid-diagram')` itself. This is a
	// real difference worth debouncing for anyway, not just for
	// convention's sake: mermaid's render() does real parse+layout work per
	// call, and without debouncing this would still re-render every
	// existing diagram on every keystroke in a document that contains any
	// mermaid block, identical to the MathJax case's per-keystroke cost —
	// this pass just distributes that cost across N separate render() calls
	// instead of one typesetPromise() call.
	//
	// Each placeholder's mermaid source lives in `data-mermaid-source`
	// (see rehype-mermaid-placeholder.ts for why a data attribute rather
	// than element text content), decoded back out via `.dataset
	// .mermaidSource` — the browser's own attribute parser already handled
	// entity-decoding when the HTML was parsed, so this reads back the
	// literal source text with no extra unescaping needed here.
	//
	// Each diagram renders independently: one placeholder's mermaid.render()
	// rejecting (invalid diagram syntax) shows an inline error in that one
	// placeholder without blocking the others in the same document from
	// rendering — matching this file's broader pattern of not letting one
	// failure blank out content that's otherwise fine (see renderError
	// handling above, which keeps showing the last-good preview rather than
	// going blank on a markdown parse error).
	let mermaidDebounceTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const el = previewEl;
		const currentHtml = html;
		if (!el) return;
		if (!currentHtml.includes('mermaid-diagram')) return;

		clearTimeout(mermaidDebounceTimer);
		let cancelled = false;
		mermaidDebounceTimer = setTimeout(() => {
			const placeholders = el.querySelectorAll<HTMLElement>('.mermaid-diagram');
			if (placeholders.length === 0) return;

			loadMermaid()
				.then(async (mermaid) => {
					if (cancelled) return;
					for (const placeholder of placeholders) {
						if (cancelled) return;
						const diagramSource = placeholder.dataset.mermaidSource ?? '';
						const renderId = `mermaid-diagram-${++mermaidRenderCounter}`;
						try {
							const { svg, bindFunctions } = await mermaid.render(renderId, diagramSource);
							if (cancelled) return;
							placeholder.innerHTML = svg;
							bindFunctions?.(placeholder);
						} catch (err: unknown) {
							if (cancelled) return;
							// Mirrors mermaid's own error-rendering shape
							// (it draws a small "Syntax error" diagram into
							// the DOM on failure via its bundled error
							// renderer) closely enough to be recognizable,
							// but as plain text rather than mermaid's own
							// error SVG — calling render() again for the
							// error state risks the exact same failure
							// looping, and the plain-text version still
							// tells the person which diagram is broken and
							// why.
							const message = err instanceof Error ? err.message : String(err);
							placeholder.textContent = `Diagram couldn't render: ${message}`;
							placeholder.classList.add('mermaid-diagram-error');
							console.error('Mermaid render failed:', err);
						}
					}
				})
				.catch((err: unknown) => {
					if (cancelled) return;
					console.error('Failed to load Mermaid:', err);
				});
		}, 400);
		return () => {
			cancelled = true;
			clearTimeout(mermaidDebounceTimer);
		};
	});
</script>

<div class="preview markdown-body" bind:this={previewEl}>
	{#if renderError}
		<div class="render-error" role="alert">Preview couldn't update: {renderError}</div>
	{/if}
	{@html html}
</div>

<style>
	.preview {
		height: 100%;
		overflow: auto;
		padding: 24px 32px;
		box-sizing: border-box;
	}

	.render-error {
		margin-bottom: 16px;
		padding: 8px 12px;
		border: 1px solid var(--error-border);
		border-radius: 6px;
		background: var(--error-bg);
		color: var(--error-fg);
		font-size: 13px;
	}

	/* Layout shell only — mermaid's own SVG output carries its own colors
	   (set via the `theme` passed to mermaid.initialize() in loadMermaid()
	   above), so this deliberately doesn't fight that with its own
	   foreground/background rules. Centered + block-level to match how
	   GitHub itself lays out rendered diagrams (a standalone block, not
	   inline with surrounding prose) rather than inheriting <pre>'s
	   monospace/left-aligned code-block styling it started from before
	   mermaid.render()'s SVG replaced its contents. */
	:global(.mermaid-diagram) {
		display: flex;
		justify-content: center;
		margin: 16px 0;
		overflow-x: auto;
	}

	:global(.mermaid-diagram-error) {
		display: block;
		padding: 8px 12px;
		border: 1px solid var(--error-border);
		border-radius: 6px;
		background: var(--error-bg);
		color: var(--error-fg);
		font-size: 13px;
		font-family: monospace;
		white-space: pre-wrap;
	}
</style>
