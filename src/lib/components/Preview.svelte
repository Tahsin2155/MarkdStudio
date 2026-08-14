<script lang="ts">
	import { renderMarkdown } from '$lib/markdown/render';

	let { source }: { source: string } = $props();

	let html = $state('');
	let renderToken = 0;

	$effect(() => {
		const src = source;
		const token = ++renderToken;
		renderMarkdown(src).then((result) => {
			// guard against out-of-order resolution when typing fast
			if (token === renderToken) html = result;
		});
	});
</script>

<div class="preview markdown-body">
	{@html html}
</div>

<style>
	.preview {
		height: 100%;
		overflow: auto;
		padding: 24px 32px;
		box-sizing: border-box;
	}
</style>
