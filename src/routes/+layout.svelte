<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { theme } from '$lib/stores/theme.svelte';
	// Light variants are bundled statically (same as before dark mode
	// existed) — small files (~24KB/~4KB), Vite inlines them into the main
	// stylesheet, zero extra network request, and light is the fallback/
	// default for the pre-hydration paint in every case except a stored or
	// OS dark preference. Dark variants are NOT statically imported: doing
	// so would ship both themes' CSS to every visitor regardless of which
	// they use. Instead they're fetched as real <link> stylesheets, but
	// only for users who actually need dark — see the $effect below and
	// app.html's blocking script for the two places that request them.
	import 'github-markdown-css/github-markdown-light.css';
	import 'highlight.js/styles/github.css';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		theme.watchSystemTheme();

		// Printing should always look like the light GitHub theme, regardless
		// of the user's screen preference — see app.css for the reasoning
		// (wastes ink, reads worse on paper). CSS alone can't achieve this:
		// github-markdown-dark.css / hljs-github-dark.css set their own
		// hardcoded hex colors on dozens of elements (code blocks, tables,
		// blockquotes, links...), not CSS custom properties, so there's no
		// single var to override for `@media print` the way app-shell chrome
		// colors are handled in app.css. Disabling the dark <link> elements
		// outright for the duration of the print is the only fix that
		// actually reaches every one of those hardcoded colors, not just the
		// ones this app happened to think to override. `.disabled = true`
		// (not removing the tag) turns the stylesheet off without dropping
		// it from the DOM or re-fetching it on restore.
		function disableDarkStylesheets() {
			const markdownLink = document.getElementById('markdown-theme-dark-css') as HTMLLinkElement | null;
			const hljsLink = document.getElementById('hljs-theme-dark-css') as HTMLLinkElement | null;
			if (markdownLink) markdownLink.disabled = true;
			if (hljsLink) hljsLink.disabled = true;
		}
		function restoreDarkStylesheets() {
			const markdownLink = document.getElementById('markdown-theme-dark-css') as HTMLLinkElement | null;
			const hljsLink = document.getElementById('hljs-theme-dark-css') as HTMLLinkElement | null;
			if (markdownLink) markdownLink.disabled = false;
			if (hljsLink) hljsLink.disabled = false;
		}
		window.addEventListener('beforeprint', disableDarkStylesheets);
		window.addEventListener('afterprint', restoreDarkStylesheets);
		return () => {
			window.removeEventListener('beforeprint', disableDarkStylesheets);
			window.removeEventListener('afterprint', restoreDarkStylesheets);
		};
	});

	// Swaps in the dark stylesheets on top of the statically-bundled light
	// ones when resolved theme is dark, and removes them otherwise. The
	// dark <link> tags are created here (not pre-existing in app.html's
	// markup) because app.html's blocking script already creates them
	// directly when it detects a stored/OS dark preference — see that file.
	// This effect is what handles every theme change AFTER that initial
	// load (the blocking script only runs once, before hydration).
	$effect(() => {
		const resolved = theme.resolved;

		function syncLink(id: string, href: string, enabled: boolean) {
			let link = document.getElementById(id) as HTMLLinkElement | null;
			if (enabled) {
				if (!link) {
					link = document.createElement('link');
					link.id = id;
					link.rel = 'stylesheet';
					document.head.appendChild(link);
				}
				link.href = href;
			} else if (link) {
				link.remove();
			}
		}

		syncLink('markdown-theme-dark-css', '/vendor/github-markdown-dark.css', resolved === 'dark');
		syncLink('hljs-theme-dark-css', '/vendor/hljs-github-dark.css', resolved === 'dark');
		document.documentElement.setAttribute('data-theme', resolved);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
