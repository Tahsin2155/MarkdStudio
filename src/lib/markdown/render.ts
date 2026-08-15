import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeGithubAlert from 'rehype-github-alert';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

// --- Rendering target: match github.com's actual output, not generic GFM ---
// See docs/rendering-target.md for the full decision writeup. In short:
// GitHub allows a specific raw-HTML allowlist beyond core GFM (kbd, mark,
// details, sup/sub, etc.) and renders `> [!NOTE]`-style alerts. Both need
// raw HTML to survive as far as the sanitizer, which is why
// allowDangerousHtml is now true (see remarkRehype below) — previously it
// was false and raw HTML was dropped upstream of the sanitizer entirely.
// rehype-sanitize is now the ACTUAL security boundary for raw HTML, not
// defense-in-depth for already-filtered content, so its schema below is
// deliberately built to match GitHub's real allowlist rather than trust
// rehype-sanitize's generic default schema.

// rehype-sanitize's defaultSchema is close to GitHub's model (it already
// carries GFM-specific carve-outs worth keeping as-is: the
// `data-footnote-*` attributes and `section.footnotes` class that
// remark-gfm's footnotes compile to, `li.task-list-item` /
// `ol.contains-task-list` for task lists, `input[type=checkbox]` for task
// list checkboxes, and the `user-content-` id/aria clobber prefix — this
// is the same clobbering protection GitHub itself applies to heading ids).
// None of that is invented; all of it matches how GFM features actually
// render on GitHub, so it's kept.
//
// What it gets wrong, checked against GitHub's real sanitization filter
// (see docs/rendering-target.md for the source list):
//   - Missing tags GitHub DOES allow: abbr, dfn, bdo, cite, caption,
//     figcaption, figure, h7, h8, mark, small, time, wbr
//   - Extra tags GitHub does NOT allow in prose: picture, source (dropped
//     below — nothing in this pipeline emits them, so this only tightens
//     the boundary, doesn't break anything working today)
//   - `section`/`input` stay despite not being in GitHub's plain-prose
//     list, because they're not raw user HTML here — they're what
//     remark-gfm's OWN footnotes/task-list compilation produces, and
//     GitHub genuinely renders footnotes/checkboxes that way.
const schema = structuredClone(defaultSchema);
schema.tagNames = [
	...(schema.tagNames ?? []).filter((tag) => tag !== 'picture' && tag !== 'source'),
	'abbr',
	'dfn',
	'bdo',
	'cite',
	'caption',
	'figcaption',
	'figure',
	'mark',
	'small',
	'time',
	'wbr'
];
// h7/h8 deliberately NOT added, despite appearing in GitHub's sanitization
// allowlist text. Checked GitHub's own docs directly (not just the raw
// allowlist): <h7>/<h8> are "undefined; rendered as <p>" on GitHub — i.e.
// the tag itself doesn't survive as a real heading, its *content* gets
// demoted into a plain paragraph. Allow-listing the tag verbatim (an
// earlier version of this schema did) produces `<p><h7>text</h7></p>`,
// which is invalid nesting and doesn't match GitHub's behavior at all —
// it was cargo-culted from the allowlist without checking what GitHub's
// renderer actually does with it. Leaving h7/h8 off the tag list means
// rehype-sanitize's normal unknown-tag handling drops the tag and keeps
// the text content, which is a much closer match to "rendered as <p>"
// than the wrong fix was. wbr added on reflection: no plugin here emits
// it, but a user CAN type it directly in raw HTML now that
// allowDangerousHtml is true, and GitHub does allow it — omitting it
// contradicted the "match GitHub exactly" goal for no real reason.

schema.attributes ??= {};

// rehype-highlight relies on `className` on `span` for syntax-highlighting
// token colors (`<span class="hljs-keyword">` etc.) — not allowed by the
// default schema, so those spans would render but silently lose all
// their classes/colors otherwise. Only the `hljs-`-prefixed classes
// highlight.js actually emits are allowed, matching the restrictiveness
// of the default schema's existing `/^language-./` pattern for `code`.
schema.attributes.span = [...(schema.attributes.span ?? []), ['className', /^hljs-/]];

// A single PropertyDefinition is [name, ...allowedPatterns] — the sanitizer
// only ever consults the FIRST attributes[tag] entry whose name matches the
// property, so appending a second, separate ['className', ...] entry here
// would be silently ignored (confirmed: it was dropping the `hljs` base
// class until this was combined into the default entry's existing list of
// allowed patterns instead of appended as its own entry).
const existingCodeClassName = schema.attributes.code?.find(
	(def) => Array.isArray(def) && def[0] === 'className'
);
if (Array.isArray(existingCodeClassName)) {
	existingCodeClassName.push(/^hljs$/);
} else {
	schema.attributes.code = [...(schema.attributes.code ?? []), ['className', /^hljs$/]];
}

// Pipeline ordering around rehype-sanitize, worked out (and corrected
// once) during review — worth documenting precisely since it's easy to
// get subtly wrong in either direction:
//
//   rehypeSlug, rehypeHighlight  ->  rehypeSanitize  ->  rehypeGithubAlert
//
// rehypeSlug and rehypeHighlight run BEFORE sanitize:
//   - rehypeSlug adds `id` attributes to headings. schema.clobberPrefix
//     ('user-content-') is applied AT SANITIZE TIME to whatever `id`s
//     exist when sanitize runs — it's not a standing rule that retroactively
//     applies to ids added later. An earlier version of this pipeline ran
//     slug AFTER sanitize and it silently broke the clobber-prefix
//     entirely (`id="real-h1"` instead of `id="user-content-real-h1"`),
//     confirmed by direct test. That prefix exists specifically to prevent
//     a user-authored heading id from clobbering page-global DOM
//     properties/JS identifiers, so losing it silently is a real
//     regression, not cosmetic — slug has to run before sanitize for the
//     prefixing to apply at all.
//   - rehypeHighlight adds `hljs`/`hljs-*` classes to `<code>`/`<span>`.
//     These need to be checked against (and survive) the schema's
//     className allowances below regardless of order, but running it
//     before sanitize means it's covered by the same single sanitize pass
//     as everything else, rather than needing a justification for why
//     it's exempt.
//
// rehypeGithubAlert runs AFTER sanitize — this is the part that actually
// matters for security, not just correctness. If alert ran before
// sanitize (an earlier version of this file had it that way), the schema
// has to specifically allow the alert plugin's own output shape (inline
// svg/path octicons, div.markdown-alert*, p.markdown-alert-title) so it
// survives the sanitize pass that comes after. But allow-listing THAT
// SHAPE means the sanitizer can no longer tell "the alert plugin
// generated this" apart from "the user typed this verbatim as raw HTML" —
// sanitization operates on the merged tree with no notion of provenance.
// Confirmed by direct test: with alert-before-sanitize, a user typing a
// literal `<svg class="octicon-evil">` or a hand-spoofed
// `<div class="markdown-alert markdown-alert-note">` both survived
// sanitization intact. Not exploitable for script execution (onload/
// <script> children still get stripped by the baseline schema), but it
// defeats the "only the plugin's own trusted shape survives" intent and
// lets a user fake a GitHub-style alert box without using real `[!NOTE]`
// syntax. Running alert AFTER sanitize removes the need for any
// alert-shaped schema entries at all: by the time the alert plugin sees
// the tree, sanitize has already run, so nothing the alert plugin adds
// afterward needs to be — or can be — spoofed through the sanitizer.

// Single reusable pipeline instance — unified processors are safe to reuse
// across calls since .process() doesn't mutate shared state per-call.
const processor = unified()
	.use(remarkParse)
	.use(remarkGfm) // tables, task lists, strikethrough, autolinks, footnotes — spec-compliant GFM
	// allowDangerousHtml + rehype-raw: raw HTML typed into markdown source
	// now survives into the HAST tree (previously dropped here entirely).
	// rehype-sanitize below — using the GitHub-matched schema above, not
	// the generic default — is the real security boundary for it, the
	// same raw-HTML-then-sanitize model GitHub itself uses.
	.use(remarkRehype, { allowDangerousHtml: true })
	.use(rehypeRaw)
	.use(rehypeSlug) // heading ids — must precede sanitize for clobber-prefix to apply
	.use(rehypeHighlight) // fenced code block syntax highlighting
	.use(rehypeSanitize, schema) // security boundary
	.use(rehypeGithubAlert) // `> [!NOTE]` etc. -> GitHub-style alert divs; trusted output, post-sanitize, unspoofable
	.use(rehypeStringify);

export async function renderMarkdown(source: string): Promise<string> {
	const file = await processor.process(source);
	return String(file);
}
