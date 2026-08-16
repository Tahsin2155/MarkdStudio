<script lang="ts">
	const features = [
		{
			title: 'GitHub-exact rendering',
			body: "Alerts, task lists, footnotes, and autolinks render exactly like they would in a GitHub README — not just close enough."
		},
		{
			title: 'Math, properly typeset',
			body: 'Inline and block math run through MathJax, so equations look like equations, not escaped LaTeX.'
		},
		{
			title: 'Real tabs, real documents',
			body: "Work on several files at once. Switch, rename, close — nothing you're not actively looking at gets in your way."
		},
		{
			title: 'Nothing leaves your browser',
			body: "Every document is saved to IndexedDB as you type. No account, no server, no sync you didn't ask for."
		}
	];
</script>

<div class="page">
	<header class="nav">
		<span class="nav-brand">MarkdStudio</span>
		<a class="nav-cta" href="/app">Open the editor</a>
	</header>

	<section class="hero">
		<h1>Markdown, rendered the way GitHub actually renders it.</h1>
		<p class="hero-sub">
			A fast, local-first editor with a live preview that doesn't cut corners — alerts, math,
			and full GFM, without an account or a server in between.
		</p>
		<div class="hero-actions">
			<a class="btn-primary" href="/app">Start writing — it's free</a>
			<a class="btn-secondary" href="https://github.com/Tahsin2155/MarkdStudio" target="_blank" rel="noreferrer">
				View on GitHub
			</a>
		</div>

		<div class="hero-preview" aria-hidden="true">
			<div class="hero-preview-bar">
				<span class="dot"></span><span class="dot"></span><span class="dot"></span>
			</div>
			<div class="hero-preview-body">
				<pre class="hero-code">{`> [!NOTE]
> Renders exactly like GitHub's alerts.

- [x] Ship the editor
- [ ] Write the docs

Euler's identity: $e^{i\\pi} + 1 = 0$`}</pre>
			</div>
		</div>
	</section>

	<section class="features">
		<h2>Built to match, not approximate</h2>
		<div class="feature-grid">
			{#each features as feature}
				<div class="feature">
					<h3>{feature.title}</h3>
					<p>{feature.body}</p>
				</div>
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
		padding: 20px 0;
	}

	.nav-brand {
		font-weight: 600;
		font-size: 15px;
		color: var(--brand);
	}

	.nav-cta {
		font-size: 14px;
		font-weight: 500;
		color: var(--fg);
		text-decoration: none;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 6px 14px;
	}

	.nav-cta:hover {
		border-color: var(--brand);
		color: var(--brand);
	}

	.hero {
		padding: 64px 0 56px;
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
		gap: 6px;
		padding: 10px 14px;
		background: var(--bg-muted);
		border-bottom: 1px solid var(--border);
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
	}

	.hero-code {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 13px;
		line-height: 1.7;
		color: #1f2328;
		white-space: pre-wrap;
	}

	.features {
		padding: 48px 0 64px;
		border-top: 1px solid var(--border);
	}

	.features h2 {
		text-align: center;
		font-size: 26px;
		letter-spacing: -0.01em;
		margin: 0 0 40px;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 32px;
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
