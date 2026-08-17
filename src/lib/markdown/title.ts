/**
 * Extracts the document title from markdown source: the text of the first
 * top-level ATX heading (`# Heading`).
 *
 * Deliberately NOT run through the full unified/remark-gfm pipeline in
 * render.ts — this runs on every keystroke (via updateContent), and a full
 * parse+rehype+highlight pass per character would be wasted work just to
 * find one line. A line scan is enough for ATX H1 syntax and is what every
 * markdown "outline"/"first heading" feature in editors like this does.
 *
 * Rules:
 * - Only ATX style (`# text`), not Setext (`Text\n===`) — matches what
 *   users actually type in a live editor; Setext requires a following line,
 *   which doesn't exist yet mid-keystroke on the heading line itself.
 * - Must be exactly one `#` (H1), 1–6 leading spaces of indentation allowed
 *   per CommonMark, not inside a fenced code block.
 * - Trailing closing `#`s, inline links/images (`[text](url)`,
 *   `![alt](url)`, reference-style `[text][ref]`), and inline formatting
 *   markers (`**` `_` `` ` ``) are stripped from the returned text since
 *   the tab title is plain text, not markdown — a heading like
 *   `# [My Project](https://x.com)` becomes the title `My Project`, not
 *   the raw markdown with brackets/url intact.
 * - Returns null if no H1 is found, so callers can fall back to a default.
 */
export function extractH1Title(source: string): string | null {
	const lines = source.split('\n');
	let inFence = false;
	let fenceMarker = '';

	for (const rawLine of lines) {
		const line = rawLine.replace(/^ {0,3}/, ''); // CommonMark allows up to 3 leading spaces

		const fenceMatch = line.match(/^(`{3,}|~{3,})/);
		if (fenceMatch) {
			if (!inFence) {
				inFence = true;
				fenceMarker = fenceMatch[1][0];
			} else if (line[0] === fenceMarker) {
				inFence = false;
			}
			continue;
		}
		if (inFence) continue;

		const h1Match = line.match(/^#(?!#)\s+(.+?)\s*#*\s*$/);
		if (h1Match) {
			const text = stripInlineMarkers(h1Match[1]);
			return text.length > 0 ? text : null;
		}
	}

	return null;
}

function stripInlineMarkers(text: string): string {
	return text
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images: keep alt text, drop the ! and url
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // inline links: keep link text, drop the url
		.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1') // reference-style links: [text][ref]
		.replace(/\[([^\]]*)\]/g, '$1') // shortcut reference links: [text] alone
		.replace(/\*\*(.+?)\*\*/g, '$1')
		.replace(/__(.+?)__/g, '$1')
		.replace(/\*(.+?)\*/g, '$1')
		.replace(/_(.+?)_/g, '$1')
		.replace(/`(.+?)`/g, '$1')
		.trim();
}

/**
 * Turns a document's display title (H1-derived or manually renamed —
 * either way, arbitrary free text, not filesystem-safe by construction)
 * into a safe `.md` filename for export.
 *
 * Deliberately doesn't just reuse extractH1Title's output verbatim:
 * that function guarantees plain *text* (markdown syntax stripped), but
 * plain text can still contain `/`, `:`, `?`, etc., all of which are
 * either invalid or awkward across Windows/macOS/Linux filesystems. This
 * is a second, narrower pass specifically for the filesystem-safety
 * property, not a duplicate of the markdown-stripping one.
 */
export function titleToFilename(title: string): string {
	const cleaned = title
		.trim()
		// Strips control characters (0x00-0x1F, 0x7F) — invalid in
		// filenames on Windows, awkward/invisible elsewhere.
		.replace(/[\x00-\x1f\x7f]/g, '')
		.replace(/[/\\:*?"<>|]/g, '-') // reserved on Windows; also just risky to shell out to elsewhere
		.replace(/\s+/g, ' ')
		.trim();

	const base = cleaned.length > 0 ? cleaned : 'untitled';
	return base.toLowerCase().endsWith('.md') ? base : `${base}.md`;
}
