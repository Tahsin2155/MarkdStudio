<script lang="ts">
	import { workspace } from '$lib/stores/workspace.svelte';

	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	function startRename(id: string, currentTitle: string) {
		renamingId = id;
		renameValue = currentTitle;
	}

	function commitRename() {
		if (renamingId) {
			workspace.renameTab(renamingId, renameValue.trim());
		}
		renamingId = null;
	}

	function handleCloseClick(e: MouseEvent, id: string) {
		e.stopPropagation();
		void workspace.closeTab(id);
	}

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

<div class="tab-bar" role="tablist">
	{#each workspace.docs as doc (doc.id)}
		<div
			role="tab"
			tabindex="0"
			class="tab"
			class:active={doc.id === workspace.activeDocId}
			aria-selected={doc.id === workspace.activeDocId}
			onclick={() => workspace.selectTab(doc.id)}
			ondblclick={() => startRename(doc.id, doc.title)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					workspace.selectTab(doc.id);
				}
			}}
		>
			{#if renamingId === doc.id}
				<input
					class="rename-input"
					bind:value={renameValue}
					onblur={commitRename}
					onkeydown={(e) => {
						if (e.key === 'Enter') commitRename();
						if (e.key === 'Escape') renamingId = null;
					}}
					onclick={(e) => e.stopPropagation()}
					use:focusOnMount
				/>
			{:else}
				<span class="tab-title">{doc.title}</span>
			{/if}

			{#if workspace.dirty.has(doc.id)}
				<span class="dirty-dot" title="Unsaved changes"></span>
			{/if}

			<button
				type="button"
				class="close-btn"
				aria-label="Close tab"
				onclick={(e) => handleCloseClick(e, doc.id)}
			>
				×
			</button>
		</div>
	{/each}

	<button type="button" class="new-tab-btn" onclick={() => void workspace.newTab()} aria-label="New document">
		+
	</button>
</div>

<style>
	.tab-bar {
		display: flex;
		align-items: stretch;
		background: var(--bg-muted);
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		flex-shrink: 0;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px 8px 14px;
		border: none;
		border-right: 1px solid var(--border);
		background: transparent;
		font-size: 13px;
		color: var(--fg-muted);
		cursor: pointer;
		white-space: nowrap;
		max-width: 200px;
	}

	.tab.active {
		background: var(--bg);
		color: var(--fg);
		box-shadow: inset 0 -2px 0 var(--brand);
	}

	.tab-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rename-input {
		font: inherit;
		font-size: 13px;
		border: 1px solid var(--brand);
		border-radius: 3px;
		padding: 1px 4px;
		width: 120px;
		background: var(--bg);
		color: var(--fg);
	}

	.dirty-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--brand);
		flex-shrink: 0;
	}

	.close-btn {
		font: inherit;
		font-size: 15px;
		line-height: 1;
		color: var(--fg-muted);
		padding: 2px 4px;
		border: none;
		background: transparent;
		border-radius: 3px;
		cursor: pointer;
	}

	.close-btn:hover {
		background: var(--border);
		color: var(--fg);
	}

	.new-tab-btn {
		border: none;
		background: transparent;
		width: 36px;
		font-size: 16px;
		color: var(--fg-muted);
		cursor: pointer;
		flex-shrink: 0;
	}

	.new-tab-btn:hover {
		background: var(--bg-muted);
	}
</style>
