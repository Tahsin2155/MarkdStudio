<script lang="ts">
	import { theme } from '$lib/stores/theme.svelte';

	const labels: Record<typeof theme.preference, string> = {
		light: 'Light',
		dark: 'Dark',
		system: 'System'
	};

	const icons: Record<typeof theme.preference, string> = {
		// Sun (light)
		light: 'M8 3a1 1 0 0 1 1 1v.5a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 3.5A2.5 2.5 0 1 1 8 11.5 2.5 2.5 0 0 1 8 6.5Zm5-.5a1 1 0 0 1 .707 1.707l-.354.354a1 1 0 1 1-1.414-1.414l.354-.354A1 1 0 0 1 13 6ZM3 6a1 1 0 0 1 .707.293l.354.354A1 1 0 1 1 2.646 8.06l-.353-.354A1 1 0 0 1 3 6Zm10 5a1 1 0 0 1 .707 1.707l-.354.353a1 1 0 0 1-1.414-1.414l.354-.353A1 1 0 0 1 13 11ZM3 11a1 1 0 0 1 .707.293l.354.353a1 1 0 1 1-1.414 1.414l-.353-.353A1 1 0 0 1 3 11ZM8 12.5a1 1 0 0 1 1 1V14a1 1 0 1 1-2 0v-.5a1 1 0 0 1 1-1ZM1 8a1 1 0 0 1 1-1h.5a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1Zm11.5-1a1 1 0 1 1 0 2H12a1 1 0 1 1 0-2h.5Z',
		// Moon (dark)
		dark: 'M9.598 1.591a.75.75 0 0 1 .785-.03A7.001 7.001 0 0 1 14 8a7 7 0 0 1-11.66 5.216.75.75 0 0 1 .567-1.285A5.5 5.5 0 0 0 9.5 2.716a.75.75 0 0 1 .098-1.125Z',
		// Monitor (system)
		system: 'M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11h-9A1.5 1.5 0 0 1 2 9.5v-6ZM6 13h4a.75.75 0 0 1 0 1.5H6A.75.75 0 0 1 6 13Z'
	};
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={() => theme.cycle()}
	title={`Theme: ${labels[theme.preference]} (click to change)`}
	aria-label={`Theme: ${labels[theme.preference]}. Click to change.`}
>
	<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
		<path d={icons[theme.preference]} />
	</svg>
</button>

<style>
	.theme-toggle {
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

	.theme-toggle:hover {
		border-color: var(--brand);
		color: var(--brand);
	}
</style>
