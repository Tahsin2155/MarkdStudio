<script lang="ts">
	import { onMount } from 'svelte';
	import { workspace } from '$lib/stores/workspace.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import Preview from '$lib/components/Preview.svelte';

	onMount(() => {
		void workspace.init();

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

<div class="app-shell">
	<header class="app-header">
		<span class="brand">MarkdStudio</span>
	</header>

	{#if workspace.ready}
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
