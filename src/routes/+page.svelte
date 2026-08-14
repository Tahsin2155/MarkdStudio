<script lang="ts">
	import { onMount } from 'svelte';
	import { workspace } from '$lib/stores/workspace.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import Preview from '$lib/components/Preview.svelte';

	onMount(() => {
		void workspace.init();

		const handleBeforeUnload = () => {
			if (workspace.activeDocId) void workspace.flush(workspace.activeDocId);
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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
