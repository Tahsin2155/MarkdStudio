<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import 'github-markdown-css/github-markdown-light.css';
	import 'highlight.js/styles/github.css';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
