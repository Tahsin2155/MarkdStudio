import { renderMarkdown } from '$lib/markdown/render';
import type { PageServerLoad } from './$types';

// The hero preview on the landing page runs through the exact same render
// pipeline /app uses (see $lib/markdown/render.ts), rather than hand-authored
// static HTML — so it can't silently drift out of sync with what the real
// pipeline actually outputs.
//
// Rendering it here (server-side, at request time) rather than client-side
// in +page.svelte matters for two real reasons, not just preference:
//   - SEO: this is the first visual content on the page. An empty
//     `<div class="hero-preview-body">` in the server-rendered HTML — which
//     is what a purely client-side `renderMarkdown().then(...)` call
//     produces, since the promise doesn't resolve within the synchronous SSR
//     snapshot — is worse for crawlers/social-card scrapers than static
//     content would be, undermining the actual point of this pass.
//   - No flash of empty content for real users before JS/hydration finishes.
//
// The markdown source itself is intentionally static/fixed (not editable),
// so pre-rendering it at request time has no correctness downside — it's
// the same output every time, just computed on the server instead of after
// the client mounts.
const heroSource = `> [!NOTE]
> Renders exactly like GitHub — same alerts, same syntax.

- [x] Ship the editor
- [ ] Write the docs

Euler's identity: $e^{i\\pi} + 1 = 0$`;

export const load: PageServerLoad = async () => {
	const heroHtml = await renderMarkdown(heroSource);
	return { heroHtml };
};
