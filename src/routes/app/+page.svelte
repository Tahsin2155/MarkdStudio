<script lang="ts">
	import { onMount } from 'svelte';
	import { workspace } from '$lib/stores/workspace.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import Preview from '$lib/components/Preview.svelte';

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
	</header>

	{#if initError}
		<div class="init-error">
			<p>Couldn't load your documents.</p>
			<p class="init-error-detail">{initError}</p>
			<button onclick={loadWorkspace}>Try again</button>
		</div>
	{:else if workspace.ready}
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
		color: #6e7781;
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
		color: #24292f;
	}

	.init-error-detail {
		color: #6e7781;
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
