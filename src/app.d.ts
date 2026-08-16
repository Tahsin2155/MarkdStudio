// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		// MathJax's tex-svg.js browser bundle (loaded via a plain <script>
		// tag in Preview.svelte, not `import` — it's a prebuilt IIFE, not an
		// ES module) attaches its API here once loaded. Typed narrowly to
		// just what's actually called; MathJax's real surface is much
		// larger, but this app only ever calls typesetPromise.
		MathJax?: {
			typesetPromise?: (elements?: Element[]) => Promise<void>;
		};
	}
}

export {};
