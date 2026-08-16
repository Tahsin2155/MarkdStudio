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
	$effect(() => {
		const el = previewEl;
		const currentHtml = html;
		if (!el) return;
		if (!currentHtml.includes('\\(') && !currentHtml.includes('\\[')) return;

		let cancelled = false;
		loadMathJax()
			.then(() => window.MathJax?.typesetPromise?.([el]))
			.catch((err: unknown) => {
				if (cancelled) return;
				console.error('MathJax typeset failed:', err);
			});
		return () => {
			cancelled = true;
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
		border: 1px solid #d1242f;
		border-radius: 6px;
		background: #fff1f0;
		color: #82071e;
		font-size: 13px;
	}
</style>
