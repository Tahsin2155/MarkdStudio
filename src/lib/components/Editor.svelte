<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView } from '@codemirror/view';
	import { createEditorState } from '$lib/editor/setup';

	// NOTE: the parent wraps this component in {#key activeDoc.id}, so a new
	// Editor instance (and thus a fresh onMount) is created on every tab
	// switch. `value` is only ever the initial content for this mount, never
	// re-synced live — the CodeMirror instance is the sole source of truth
	// for its own content while mounted, and onChange pushes edits to the
	// workspace store as the user types.
	let {
		value,
		onChange
	}: {
		value: string;
		onChange: (value: string) => void;
	} = $props();

	let container: HTMLDivElement;
	let view: EditorView | undefined;

	onMount(() => {
		view = new EditorView({
			state: createEditorState(value, onChange),
			parent: container
		});
	});

	onDestroy(() => {
		view?.destroy();
	});
</script>

<div class="editor-host" bind:this={container}></div>

<style>
	.editor-host {
		height: 100%;
		overflow: auto;
	}
	.editor-host :global(.cm-editor) {
		height: 100%;
	}
</style>
