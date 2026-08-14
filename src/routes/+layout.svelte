<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import 'github-markdown-css/github-markdown-light.css';
	import 'highlight.js/styles/github.css';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MarkdStudio — Free Online Markdown Editor with Live Preview</title>
	<meta
		name="description"
		content="Write GitHub-flavored Markdown with a live preview, multi-document tabs, and offline autosave. Free, no signup required."
	/>
</svelte:head>

{@render children()}
