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
 * - Trailing closing `#`s and inline formatting markers (*_`) are stripped
 *   from the returned text since the tab title is plain text, not markdown.
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
		.replace(/\*\*(.+?)\*\*/g, '$1')
		.replace(/__(.+?)__/g, '$1')
		.replace(/\*(.+?)\*/g, '$1')
		.replace(/_(.+?)_/g, '$1')
		.replace(/`(.+?)`/g, '$1')
		.trim();
}
