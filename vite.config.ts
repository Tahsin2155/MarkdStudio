import adapter from '@sveltejs/adapter-netlify';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Copies MathJax's prebuilt browser bundle (tex-svg.js — a plain
// self-executing script, not an ES module, so it can't just be `import`ed
// and bundled normally; see Preview.svelte for how it's loaded) from
// node_modules into static/vendor/ so SvelteKit serves it verbatim.
// Also copies the sre/ directory alongside it: tex-svg.js loads a speech-
// worker script from a path relative to itself at runtime, for
// accessibility (screen-reader math descriptions) — confirmed by a real
// browser test that omitting sre/ leaves math rendering itself working,
// but throws a console error on every render as that fetch 404s. Copied
// as a whole directory since tex-svg.js resolves these paths internally
// and the exact subset of files it needs isn't documented anywhere worth
// trusting over just mirroring the real layout.
//
// Also copies the two DARK theme-dependent stylesheets (github-markdown-
// css dark, highlight.js github-dark) into the same static/vendor/
// directory. These need to be plain, independently-fetchable CSS files
// rather than Vite-bundled `import`s because dark mode is loaded on
// demand only for users who need it (see app.html's blocking script and
// +layout.svelte's theme $effect) — the light variants stay as regular
// bundled `import`s in +layout.svelte since they're needed for every
// visitor regardless of theme.
//
// Generated at build/dev-start time rather than committed to the repo,
// same reasoning as node_modules itself being gitignored: a multi-
// megabyte set of third-party files doesn't belong in git history, and
// copying it here keeps it automatically in sync with whatever version
// `mathjax`/`github-markdown-css`/`highlight.js` are pinned to in
// package.json, rather than risking a manually-copied file silently
// going stale after a dependency bump.
function copyMathJaxVendorFiles(): Plugin {
	const copy = async () => {
		const root = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
		const destDir = root('./static/vendor');
		await mkdir(destDir, { recursive: true });
		await cp(root('./node_modules/mathjax/tex-svg.js'), root('./static/vendor/mathjax-tex-svg.js'));
		await cp(root('./node_modules/mathjax/sre'), root('./static/vendor/sre'), { recursive: true });

		await cp(
			root('./node_modules/github-markdown-css/github-markdown-dark.css'),
			root('./static/vendor/github-markdown-dark.css')
		);
		await cp(
			root('./node_modules/highlight.js/styles/github-dark.css'),
			root('./static/vendor/hljs-github-dark.css')
		);
	};
	return {
		name: 'copy-mathjax-vendor-files',
		buildStart: copy,
		configureServer: copy
	};
}

export default defineConfig({
	plugins: [
		copyMathJaxVendorFiles(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter({ edge: false, split: false })
		})
	]
});
