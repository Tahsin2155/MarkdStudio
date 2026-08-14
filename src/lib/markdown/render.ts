import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

// Single reusable pipeline instance — unified processors are safe to reuse
// across calls since .process() doesn't mutate shared state per-call.
const processor = unified()
	.use(remarkParse)
	.use(remarkGfm) // tables, task lists, strikethrough, autolinks, footnotes — spec-compliant GFM
	.use(remarkRehype, { allowDangerousHtml: false })
	.use(rehypeSlug) // stable heading ids, useful later for a TOC
	.use(rehypeHighlight) // fenced code block syntax highlighting
	.use(rehypeStringify);

export async function renderMarkdown(source: string): Promise<string> {
	const file = await processor.process(source);
	return String(file);
}
