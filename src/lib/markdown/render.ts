import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

// rehype-sanitize's defaultSchema already follows GitHub-style sanitation
// (allows the `code[className]`/task-list classes GFM needs, prefixes
// heading `id`s with `user-content-` the same way GitHub does to prevent
// DOM-clobbering). It does NOT allow `className` on `span`, though, which
// rehype-highlight relies on for syntax-highlighting token colors
// (`<span class="hljs-keyword">` etc.) — so those spans would render but
// silently lose all their classes/colors under the unmodified default.
// Only the `hljs-`-prefixed classes highlight.js actually emits are
// allowed, same restrictiveness as the default schema's existing
// `/^language-./` pattern for `code`.
const schema = structuredClone(defaultSchema);
schema.attributes ??= {};
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

// Single reusable pipeline instance — unified processors are safe to reuse
// across calls since .process() doesn't mutate shared state per-call.
//
// allowDangerousHtml stays false: raw HTML typed into the markdown source
// is dropped at the remark-rehype boundary, not merely sanitized later.
// rehype-sanitize below is defense-in-depth for the pipeline's OWN
// generated output (and for whenever rehype-raw gets added for features
// like <details> support, at which point this stops being optional) — the
// two protect different things and neither replaces the other.
const processor = unified()
	.use(remarkParse)
	.use(remarkGfm) // tables, task lists, strikethrough, autolinks, footnotes — spec-compliant GFM
	.use(remarkRehype, { allowDangerousHtml: false })
	.use(rehypeSlug) // stable heading ids, useful later for a TOC
	.use(rehypeHighlight) // fenced code block syntax highlighting
	.use(rehypeSanitize, schema)
	.use(rehypeStringify);

export async function renderMarkdown(source: string): Promise<string> {
	const file = await processor.process(source);
	return String(file);
}
