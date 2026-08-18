<script lang="ts">
	import { onMount } from 'svelte';
	import { workspace } from '$lib/stores/workspace.svelte';
	import { titleToFilename } from '$lib/markdown/title';
	import TabBar from '$lib/components/TabBar.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import Preview from '$lib/components/Preview.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let initError = $state<string | null>(null);

	function loadWorkspace() {
		initError = null;
		workspace.init().catch((err: unknown) => {
			// Previously an unguarded `void workspace.init()` — a throw here
			// (IndexedDB unavailable in private browsing, a corrupted DB, a
			// blocked upgrade from another open tab, etc.) left `ready` stuck
			// at false forever with no error surfaced: the app just sat on
			// "Loading your documents…" indefinitely with nothing telling the
			// user, or anyone debugging it, what went wrong.
			initError = err instanceof Error ? err.message : String(err);
			console.error('Workspace init failed:', err);
		});
	}

	onMount(() => {
		loadWorkspace();

		// No single event reliably catches "about to lose the page" across
		// browsers, so this stacks three, each covering the others' gaps:
		//  - visibilitychange (hidden): fires on tab switch/backgrounding.
		//    Best mobile coverage, but Chrome/WebKit have historically been
		//    inconsistent about firing it during same-tab reload/close.
		//  - pagehide: fires on navigation/reload/close, including bfcache
		//    cases where beforeunload/unload don't fire.
		//  - beforeunload: desktop-navigation coverage, weakest on mobile.
		// All three call the same async flush — none of them can guarantee
		// the IndexedDB write finishes before teardown, so this narrows the
		// loss window rather than closing it with certainty. That's paired
		// with a short autosave debounce (see workspace store) to keep the
		// window small regardless of which event actually fires.
		const flushActive = () => {
			if (workspace.activeDocId) void workspace.flush(workspace.activeDocId);
		};
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') flushActive();
		};

		window.addEventListener('beforeunload', flushActive);
		window.addEventListener('pagehide', flushActive);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => {
			window.removeEventListener('beforeunload', flushActive);
			window.removeEventListener('pagehide', flushActive);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	function handleEditorChange(value: string) {
		if (workspace.activeDocId) {
			workspace.updateContent(workspace.activeDocId, value);
		}
	}

	// --- Export ---
	// Uses workspace.activeDoc.content directly (the live in-memory copy,
	// updated on every keystroke via updateContent) rather than reading
	// back from IndexedDB — that in-memory value is always current, so
	// there's no staleness/flush-timing concern to work around here, unlike
	// the teardown-flush logic above which exists specifically because
	// IndexedDB *can* lag behind memory at page-unload time.
	function handleExport() {
		const doc = workspace.activeDoc;
		if (!doc) return;
		const filename = titleToFilename(doc.title);
		const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		// Revoking synchronously right after click() is safe: the download
		// is triggered by the click itself (browser reads the blob during
		// that synchronous dispatch), not by some later async step that
		// could race with the revoke.
		URL.revokeObjectURL(url);
	}

	// --- Import ---
	let fileInput: HTMLInputElement | undefined = $state();

	function handleImportClick() {
		fileInput?.click();
	}

	async function handleFileSelected(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// Reset the input's value regardless of outcome (including the early
		// `if (!file) return` below) — without this, selecting the SAME
		// filename twice in a row wouldn't fire a second `change` event at
		// all, since the input's value hadn't changed from the browser's
		// point of view.
		input.value = '';
		if (!file) return;

		try {
			const content = await file.text();
			const suggestedTitle = file.name.replace(/\.md$/i, '') || 'untitled.md';
			await workspace.importDoc(content, suggestedTitle);
		} catch (err: unknown) {
			// Mirrors the init-error pattern above: surface it, don't let a
			// failed read (permissions, a file that got deleted between
			// picking and reading, etc.) fail silently.
			importError = err instanceof Error ? err.message : String(err);
			console.error('Import failed:', err);
		}
	}

	let importError = $state<string | null>(null);
</script>

<svelte:head>
	<title>MarkdStudio App — Free Online Markdown Editor</title>
	<meta
		name="description"
		content="Write and preview Markdown that renders exactly like GitHub — alerts, tables, task lists, and MathJax equations. Multi-tab documents, autosaved locally in your browser. No signup."
	/>
	<link rel="canonical" href="https://markdstudio.netlify.app/app" />
	<meta name="robots" content="index, follow" />
</svelte:head>

<div class="app-shell">
	<header class="app-header">
		<a class="brand" href="/">MarkdStudio</a>
		<div class="header-actions">
			<input
				type="file"
				accept=".md,text/markdown"
				bind:this={fileInput}
				onchange={handleFileSelected}
				style="display: none"
			/>
			<button
				type="button"
				class="icon-btn"
				onclick={handleImportClick}
				title="Import .md file"
				aria-label="Import .md file"
				disabled={!workspace.ready}
			>
				<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
					<path
						d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14ZM7.25 2.689V9.5a.75.75 0 0 0 1.5 0V2.689l1.97 1.969a.749.749 0 1 0 1.06-1.06L8.53.348a.749.749 0 0 0-1.06 0L4.22 3.598a.749.749 0 1 0 1.06 1.06Z"
					/>
				</svg>
			</button>
			<button
				type="button"
				class="icon-btn"
				onclick={handleExport}
				title="Download as .md"
				aria-label="Download as .md"
				disabled={!workspace.activeDoc}
			>
				<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
					<path
						d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Zm2.72-6.53a.749.749 0 1 1 1.06-1.06l1.97 1.969V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0Z"
					/>
				</svg>
			</button>
			<button
				type="button"
				class="icon-btn"
				onclick={() => window.print()}
				title="Print preview"
				aria-label="Print preview"
			>
				<!-- Known gap, same spirit as the visibilitychange caveat
				     documented in onMount above: Safari has historically been
				     inconsistent about firing beforeprint/afterprint for a
				     programmatic window.print() call specifically (vs. the
				     browser's own native print menu/Cmd+P), which is what
				     +layout.svelte's dark-stylesheet-disable listens for. Not
				     independently re-verified against current Safari in this
				     session — flagging as inherited risk, not a confirmed
				     bug, since retesting every browser's current behavior on
				     every pass isn't practical. If a Safari user in dark mode
				     ends up with a dark-background printout, this is why. -->
				<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
					<path
						d="M13 2.5H3a.5.5 0 0 0-.5.5v2h11V3a.5.5 0 0 0-.5-.5ZM14.5 5H1.5A1.5 1.5 0 0 0 0 6.5v4A1.5 1.5 0 0 0 1.5 12H2v2.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V12h.5a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 14.5 5ZM12 14H4v-4h8v4Zm1-6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
					/>
				</svg>
			</button>
			<ThemeToggle />
		</div>
	</header>

	{#if initError}
		<div class="init-error">
			<p>Couldn't load your documents.</p>
			<p class="init-error-detail">{initError}</p>
			<button onclick={loadWorkspace}>Try again</button>
		</div>
	{:else if workspace.ready}
		{#if importError}
			<div class="import-error" role="alert">
				<span>Import failed: {importError}</span>
				<button type="button" onclick={() => (importError = null)} aria-label="Dismiss">×</button>
			</div>
		{/if}
		<TabBar />

		<main class="workspace">
			{#if workspace.activeDoc}
				{#key workspace.activeDoc.id}
					<section class="pane editor-pane">
						<Editor value={workspace.activeDoc.content} onChange={handleEditorChange} />
					</section>
				{/key}
				<section class="pane preview-pane">
					<Preview source={workspace.activeDoc.content} />
				</section>
			{/if}
		</main>
	{:else}
		<div class="loading">Loading your documents…</div>
	{/if}
</div>

<style>
	.app-shell {
		height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.app-header {
		flex-shrink: 0;
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: transparent;
		color: var(--fg-muted, #57606a);
		cursor: pointer;
		flex-shrink: 0;
	}

	.icon-btn:hover {
		border-color: var(--brand);
		color: var(--brand);
	}

	.icon-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.icon-btn:disabled:hover {
		border-color: var(--border);
		color: var(--fg-muted, #57606a);
	}

	@media print {
		.app-header,
		:global(.tab-bar),
		.editor-pane,
		.import-error {
			display: none !important;
		}
		.app-shell {
			height: auto;
		}
		.workspace {
			display: block;
		}
		.preview-pane {
			height: auto;
			border: none;
		}
		:global(.preview) {
			padding: 0;
			overflow: visible;
			height: auto;
		}
	}

	.brand {
		font-weight: 600;
		color: var(--brand);
		font-size: 15px;
		text-decoration: none;
	}

	.workspace {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.pane {
		flex: 1;
		min-width: 0;
		height: 100%;
	}

	.editor-pane {
		border-right: 1px solid var(--border);
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: var(--fg-muted);
	}

	.import-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 16px;
		background: var(--error-bg);
		color: var(--error-fg);
		font-size: 13px;
		border-bottom: 1px solid var(--error-border);
		flex-shrink: 0;
	}

	.import-error button {
		border: none;
		background: transparent;
		color: inherit;
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
		padding: 0 4px;
	}

	.init-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		flex: 1;
		padding: 24px;
		text-align: center;
		color: var(--fg);
	}

	.init-error-detail {
		color: var(--fg-muted);
		font-size: 13px;
		font-family: monospace;
	}

	.init-error button {
		margin-top: 8px;
		padding: 6px 16px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--brand);
		color: #fff;
		cursor: pointer;
		font-size: 14px;
	}

	@media (max-width: 720px) {
		.workspace {
			flex-direction: column;
		}
		.editor-pane {
			border-right: none;
			border-bottom: 1px solid var(--border);
			height: 50%;
		}
		.preview-pane {
			height: 50%;
		}
	}
</style>
