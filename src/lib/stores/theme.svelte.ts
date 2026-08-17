// Theme state shared across the app. Two things read/write this:
//   - The inline blocking script in app.html, which runs before first paint
//     to set `data-theme` on <html> synchronously (avoids a light->dark
//     flash on load — see app.html for why this can't just be a Svelte
//     $effect, which would only run after hydration).
//   - This module, which is what the rest of the app (theme toggle button,
//     dynamic stylesheet swap) actually interacts with after hydration.
//
// Storage key and value shape are deliberately kept in sync with the
// inline script's own (duplicated, unavoidably — see app.html) logic.
//
// --- Module-level singleton in an SSR context: why this is safe here,
// specifically, and the invariant that has to hold for it to stay that way ---
// `export const theme = new ThemeStore()` below is a module-level
// singleton — constructed once per server process, not once per request.
// That's a well-documented SvelteKit foot-gun for request-scoped/
// per-user data: if this store held something that legitimately differs
// by request (a signed-in user's saved preference from a DB, a cookie),
// mutating it server-side would leak between concurrent requests, since
// every request on that server process shares the same instance.
//
// It's safe here only because of a narrower fact, not because singletons
// are fine in general: `getSystemTheme()`/`readStoredPreference()` return
// the exact same hardcoded value (`'light'`/`'system'`) for EVERY
// server-side evaluation, regardless of which request triggered it —
// `window`/`localStorage` are simply undefined during SSR, full stop,
// with no per-request branching. There is no real personalization
// happening server-side for this store to leak; every user's SSR output
// is identical on this axis today. `setPreference()`/`cycle()` are only
// ever wired to client `onclick` handlers, so they have no server-side
// call path that could mutate the shared instance.
//
// This safety is NOT structural — it depends on that invariant holding.
// If a future change made SSR theme-aware (reading a theme cookie in a
// load function, say, to avoid the flash-of-wrong-theme this app
// currently accepts via the client-side blocking script instead), this
// singleton shape would need to change to a per-request pattern (context
// API via setContext/getContext, seeded from load data) — reusing this
// module as-is at that point would reintroduce exactly the leak this
// comment is explaining why we don't have yet.

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'markdstudio-theme';

function getSystemTheme(): 'light' | 'dark' {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredPreference(): ThemePreference {
	if (typeof localStorage === 'undefined') return 'system';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark') return stored;
	return 'system';
}

class ThemeStore {
	// Initialized synchronously from real values (not deferred to a
	// separate init() called from onMount) specifically to avoid an
	// ordering bug: +layout.svelte's $effect that syncs the dark
	// stylesheet <link> tags reads `resolved` on its first run, and
	// Svelte does not guarantee that a component's own onMount fires
	// before ITS OWN $effects evaluate for the first time (both are tied
	// to the same initial-mount point, not sequenced against each other).
	// With `preference`/`systemTheme` starting at hardcoded defaults and
	// only getting their real values inside an init() called from
	// onMount, the $effect could plausibly run its first pass against the
	// stale defaults (reading `resolved` as 'light' even in a real dark
	// preference) and actively REMOVE the dark <link> tags that app.html's
	// blocking script had already correctly injected pre-hydration — the
	// exact flash this whole architecture exists to prevent, just moved
	// to a different, later point (post-hydration instead of pre-paint).
	// Reading localStorage/matchMedia directly in the field initializer
	// instead removes the ordering dependency entirely rather than trying
	// to win the race.
	preference = $state<ThemePreference>(readStoredPreference());
	private systemTheme = $state<'light' | 'dark'>(getSystemTheme());

	get resolved(): 'light' | 'dark' {
		return this.preference === 'system' ? this.systemTheme : this.preference;
	}

	/**
	 * Registers the one thing that genuinely can't happen at construction
	 * time: a live matchMedia listener for OS theme changes AFTER the
	 * initial load. (`preference`/`systemTheme` themselves no longer need
	 * this method to get their correct starting values — see the field
	 * initializers above.) Still called from onMount in +layout.svelte;
	 * that's fine for this piece specifically, since nothing needs the
	 * listener to be attached before first render, only before the user
	 * could plausibly change their OS theme mid-session.
	 */
	watchSystemTheme() {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		// Older Safari lacks addEventListener on MediaQueryList; this app's
		// browser-support bar (real MathJax runtime, CodeMirror 6) already
		// assumes a modern evergreen browser elsewhere, so no addListener
		// fallback here either.
		mq.addEventListener('change', (e) => {
			this.systemTheme = e.matches ? 'dark' : 'light';
		});
	}

	setPreference(pref: ThemePreference) {
		this.preference = pref;
		if (pref === 'system') {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, pref);
		}
	}

	/** Cycles light -> dark -> system -> light, for a single toggle button. */
	cycle() {
		const next: Record<ThemePreference, ThemePreference> = {
			light: 'dark',
			dark: 'system',
			system: 'light'
		};
		this.setPreference(next[this.preference]);
	}
}

export const theme = new ThemeStore();
