<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Same MathJax client-runtime pattern as Preview.svelte — see that file
	// for the full reasoning (rehype-mathjax/browser only delimits math as
	// text, actual typesetting needs MathJax's real browser bundle loaded
	// separately). Duplicated rather than imported since Preview.svelte's
	// version is coupled to its own debounce/effect lifecycle, which this
	// static hero doesn't need. The markdown source itself lives in
	// +page.server.ts now — rendered at request time so the hero has real
	// content in the server-rendered HTML instead of filling in after
	// hydration (see that file for why this matters for SEO).
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

	let heroPreviewEl: HTMLDivElement | undefined = $state();
	$effect(() => {
		const el = heroPreviewEl;
		const html = data.heroHtml;
		if (!el || !html) return;
		if (!html.includes('\\(') && !html.includes('\\[')) return;
		loadMathJax().then(() => window.MathJax?.typesetPromise?.([el]));
	});

	const features = [
		{
			title: 'GitHub-exact rendering',
			body: 'Alerts, task lists, footnotes, and autolinks render the way they actually do on github.com — including the exact raw-HTML tags GitHub allows, like kbd, mark, and details.'
		},
		{
			title: 'Math via MathJax',
			body: "GitHub's math rendering runs on MathJax, not KaTeX — so this does too. Inline $...$ and block $$...$$ equations typeset client-side, the same engine GitHub uses."
		},
		{
			title: 'Real tabs, real documents',
			body: 'Work on several files at once. Open, close, switch, rename — unsaved changes are marked so nothing gets lost by accident.'
		},
		{
			title: 'Nothing leaves your browser',
			body: "Every document autosaves to IndexedDB as you type. No account, no server round-trip, no sync you didn't ask for."
		}
	];

	const faqs = [
		{
			q: 'What is MarkdStudio?',
			a: "A free Markdown editor with a live preview that matches GitHub's actual rendering — not just the general GFM spec, but GitHub's specific alerts, raw-HTML allowlist, and MathJax-based math. It runs entirely in your browser."
		},
		{
			q: 'Does it work offline?',
			a: 'Your documents are stored locally via IndexedDB, so your work persists across reloads without a server. Full offline app-shell caching is planned but not yet built.'
		},
		{
			q: 'Can I export my document?',
			a: "Not yet — export (Markdown download, HTML, PDF) is on the roadmap but isn't built in this version. Right now your documents live in your browser's local storage."
		},
		{
			q: 'Is MarkdStudio free?',
			a: 'Yes. No premium tier, no account, no signup, for every feature that exists today.'
		},
		{
			q: 'Does it support KaTeX or Mermaid diagrams?',
			a: "Math rendering uses MathJax — the same engine GitHub itself uses — rather than KaTeX. Mermaid diagram support isn't built yet."
		}
	];
</script>

<svelte:head>
	<title>MarkdStudio — Free Online Markdown Editor with Live Preview</title>
	<meta
		name="description"
		content="Write Markdown that renders exactly like GitHub — alerts, tables, task lists, and MathJax equations — with a live preview. Multi-tab documents, local autosave, no signup required."
	/>
	<link rel="canonical" href="https://markdstudio.netlify.app/" />
	<meta name="robots" content="index, follow, max-image-preview:large" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="MarkdStudio" />
	<meta property="og:title" content="MarkdStudio — Free Online Markdown Editor with Live Preview" />
	<meta
		property="og:description"
		content="Write Markdown that renders exactly like GitHub — alerts, tables, task lists, and MathJax equations. Free, no signup required."
	/>
	<meta property="og:url" content="https://markdstudio.netlify.app/" />
	<meta property="og:image" content="https://markdstudio.netlify.app/assets/og-image.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="MarkdStudio landing page preview" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="MarkdStudio — Free Online Markdown Editor with Live Preview" />
	<meta
		name="twitter:description"
		content="Markdown editor with a live preview that matches GitHub's actual rendering. Free, no signup required."
	/>
	<meta name="twitter:image" content="https://markdstudio.netlify.app/assets/og-image.png" />
	<meta name="twitter:image:alt" content="MarkdStudio landing page preview" />

	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "WebApplication",
			"name": "MarkdStudio",
			"url": "https://markdstudio.netlify.app/",
			"applicationCategory": "DeveloperApplication",
			"operatingSystem": "Any (browser-based)",
			"offers": {
				"@type": "Offer",
				"price": "0",
				"priceCurrency": "USD"
			},
			"description": "Free online Markdown editor with a live preview that matches GitHub's actual rendering, including alerts and MathJax equations."
		}
	</script>
</svelte:head>

<div class="page">
	<header class="nav">
		<span class="nav-brand">MarkdStudio</span>
		<nav class="nav-links">
			<a href="#features">Features</a>
			<a href="#faq">FAQ</a>
			<a href="https://github.com/Tahsin2155/MarkdStudio" target="_blank" rel="noreferrer">GitHub</a>
		</nav>
		<a class="nav-cta" href="/app">Open the editor</a>
	</header>

	<section class="hero">
		<p class="eyebrow">browser-based · free · no signup</p>
		<h1>Markdown, rendered the way GitHub actually renders it.</h1>
		<p class="hero-sub">
			A fast, local-first editor with a live preview that doesn't cut corners — GitHub-exact
			alerts, MathJax equations, and full GFM, without an account or a server in between.
		</p>
		<div class="hero-actions">
			<a class="btn-primary" href="/app">Start writing — it's free</a>
			<a class="btn-secondary" href="#features">See features</a>
		</div>

		<div class="hero-preview">
			<div class="hero-preview-bar">
				<span class="dot"></span><span class="dot"></span><span class="dot"></span>
				<span class="hero-preview-filename">notes.md</span>
			</div>
			<div class="hero-preview-body markdown-body" bind:this={heroPreviewEl}>
				{@html data.heroHtml}
			</div>
		</div>
	</section>

	<section class="features" id="features">
		<p class="eyebrow center">features</p>
		<h2>Built to match, not approximate</h2>
		<p class="section-sub">
			Everything below is live in the app today — nothing here is a roadmap item.
		</p>
		<div class="feature-grid">
			{#each features as feature}
				<div class="feature">
					<h3>{feature.title}</h3>
					<p>{feature.body}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="faq" id="faq">
		<p class="eyebrow center">questions</p>
		<h2>Frequently asked questions</h2>
		<div class="faq-list">
			{#each faqs as item}
				<details class="faq-item">
					<summary>{item.q}</summary>
					<p>{item.a}</p>
				</details>
			{/each}
		</div>
	</section>

	<section class="closing">
		<h2>No signup. No sync. Just Markdown.</h2>
		<a class="btn-primary" href="/app">Open MarkdStudio</a>
	</section>

	<footer class="footer">
		<span>MarkdStudio</span>
		<a href="https://github.com/Tahsin2155/MarkdStudio" target="_blank" rel="noreferrer">GitHub</a>
	</footer>
</div>

<style>
	.page {
		max-width: 1040px;
		margin: 0 auto;
		padding: 0 24px;
	}

	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 20px 0;
	}

	.nav-brand {
		font-weight: 600;
		font-size: 15px;
		color: var(--brand);
	}

	.nav-links {
		display: flex;
		gap: 24px;
		margin-right: auto;
		margin-left: 40px;
	}

	.nav-links a {
		font-size: 14px;
		color: #57606a;
		text-decoration: none;
	}

	.nav-links a:hover {
		color: var(--fg);
	}

	.nav-cta {
		font-size: 14px;
		font-weight: 500;
		color: var(--fg);
		text-decoration: none;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 6px 14px;
		white-space: nowrap;
	}

	.nav-cta:hover {
		border-color: var(--brand);
		color: var(--brand);
	}

	.eyebrow {
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--brand);
		margin: 0 0 12px;
	}

	.eyebrow.center {
		text-align: center;
	}

	.hero {
		padding: 56px 0 64px;
		text-align: center;
	}

	.hero h1 {
		font-size: 44px;
		line-height: 1.15;
		letter-spacing: -0.02em;
		margin: 0 auto 20px;
		max-width: 720px;
		color: var(--fg);
	}

	.hero-sub {
		font-size: 18px;
		line-height: 1.6;
		color: #57606a;
		max-width: 560px;
		margin: 0 auto 32px;
	}

	.hero-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
		margin-bottom: 56px;
	}

	.btn-primary {
		background: var(--brand);
		color: #fff;
		text-decoration: none;
		font-weight: 500;
		font-size: 15px;
		padding: 11px 22px;
		border-radius: 6px;
		border: 1px solid var(--brand);
	}

	.btn-primary:hover {
		background: #0757ba;
	}

	.btn-secondary {
		color: var(--fg);
		text-decoration: none;
		font-weight: 500;
		font-size: 15px;
		padding: 11px 22px;
		border-radius: 6px;
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		border-color: #8c959f;
	}

	.hero-preview {
		max-width: 640px;
		margin: 0 auto;
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 8px 24px rgba(140, 149, 159, 0.15);
		text-align: left;
	}

	.hero-preview-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		background: var(--bg-muted);
		border-bottom: 1px solid var(--border);
	}

	.hero-preview-filename {
		margin-left: 10px;
		font-size: 12px;
		color: #6e7781;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #d0d7de;
	}

	.hero-preview-body {
		background: #ffffff;
		padding: 20px 24px;
		font-size: 14px;
	}

	.features {
		padding: 48px 0 64px;
		border-top: 1px solid var(--border);
		text-align: center;
	}

	.features h2 {
		font-size: 26px;
		letter-spacing: -0.01em;
		margin: 0 0 12px;
	}

	.section-sub {
		color: #57606a;
		font-size: 15px;
		margin: 0 0 40px;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 32px;
		text-align: left;
	}

	.feature h3 {
		font-size: 17px;
		margin: 0 0 8px;
		color: var(--fg);
	}

	.feature p {
		font-size: 15px;
		line-height: 1.6;
		color: #57606a;
		margin: 0;
	}

	.faq {
		padding: 48px 0 64px;
		border-top: 1px solid var(--border);
		text-align: center;
	}

	.faq h2 {
		font-size: 26px;
		letter-spacing: -0.01em;
		margin: 0 0 40px;
	}

	.faq-list {
		max-width: 680px;
		margin: 0 auto;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.faq-item {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 14px 18px;
	}

	.faq-item summary {
		cursor: pointer;
		font-weight: 500;
		font-size: 15px;
		color: var(--fg);
		list-style: none;
	}

	.faq-item summary::-webkit-details-marker {
		display: none;
	}

	.faq-item summary::before {
		content: '+';
		display: inline-block;
		width: 16px;
		color: var(--brand);
		font-weight: 600;
	}

	.faq-item[open] summary::before {
		content: '−';
	}

	.faq-item p {
		margin: 10px 0 2px 16px;
		font-size: 14px;
		line-height: 1.6;
		color: #57606a;
	}

	.closing {
		text-align: center;
		padding: 56px 0;
		border-top: 1px solid var(--border);
	}

	.closing h2 {
		font-size: 24px;
		margin: 0 0 24px;
	}

	.footer {
		display: flex;
		justify-content: space-between;
		padding: 24px 0 40px;
		border-top: 1px solid var(--border);
		font-size: 13px;
		color: #6e7781;
	}

	.footer a {
		color: #6e7781;
	}

	@media (max-width: 640px) {
		.nav-links {
			display: none;
		}
		.hero h1 {
			font-size: 32px;
		}
		.hero-actions {
			flex-direction: column;
			align-items: stretch;
			max-width: 280px;
			margin-left: auto;
			margin-right: auto;
		}
		.feature-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
