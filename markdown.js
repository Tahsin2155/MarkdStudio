// ================================================================
//  MarkdStudio — Markdown Processing Module
//  Pure markdown rendering, preprocessing, and conversion logic.
// ================================================================

var MarkdEngine = (function () {
    'use strict';

    // ================================================================
    //  CONSTANTS
    // ================================================================

    const ATTRIBUTION_LINK = '[Rendered best with MarkdStudio](https://markdstudio.netlify.app)';
    const ATTRIBUTION_LINK_RE = /\[Rendered best with MarkdStudio\]\(https:\/\/markdstudio\.netlify\.app\)/i;
    const ATTRIBUTION_TRAILING_BLOCK_RE = /\n{2,}---\n{2,}\[Rendered best with MarkdStudio\]\(https:\/\/markdstudio\.netlify\.app\)\s*$/i;
    const ATTRIBUTION_LINE_RE = /^\[Rendered best with MarkdStudio\]\(https:\/\/markdstudio\.netlify\.app\)\s*$/gmi;
    const FOOTNOTE_DEF_RE = /^\[\^([^\]]+)\]:\s*(.+)$/gm;
    const FOOTNOTE_REF_RE = /\[\^([^\]]+)\]/g;
    const FOOTNOTE_APP_PATH = '/app';
    const DISPLAY_MATH_RE = /\$\$([\s\S]+?)\$\$/g;
    const INLINE_MATH_RE = /(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g;
    const EMOJI_RE = /:([a-z0-9_+-]+):/gi;
    const HTML_ESCAPE_RE = /[&<>"']/g;
    const HTML_ESCAPE_MAP = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    const EMOJI_MAP = {
        ':smile:': '😄', ':grinning:': '😀', ':laughing:': '😆', ':joy:': '😂',
        ':heart:': '❤️', ':hearts:': '❤️', ':thumbsup:': '👍', ':+1:': '👍',
        ':thumbsdown:': '👎', ':-1:': '👎', ':star:': '⭐', ':star2:': '🌟',
        ':fire:': '🔥', ':rocket:': '🚀', ':check:': '✅', ':white_check_mark:': '✅',
        ':x:': '❌', ':warning:': '⚠️', ':bulb:': '💡', ':memo:': '📝',
        ':link:': '🔗', ':book:': '📖', ':sparkles:': '✨', ':bug:': '🐛',
        ':wrench:': '🔧', ':lock:': '🔒', ':key:': '🔑', ':tada:': '🎉',
        ':eyes:': '👀', ':thinking:': '🤔', ':wave:': '👋', ':clap:': '👏',
        ':100:': '💯', ':zap:': '⚡', ':globe_with_meridians:': '🌐',
        ':package:': '📦', ':hammer:': '🔨', ':gear:': '⚙️', ':shield:': '🛡️',
        ':arrow_right:': '➡️', ':arrow_left:': '⬅️', ':arrow_up:': '⬆️',
        ':arrow_down:': '⬇️', ':heavy_check_mark:': '✔️', ':point_right:': '👉',
        ':information_source:': 'ℹ️', ':exclamation:': '❗', ':question:': '❓',
    };

    // ================================================================
    //  RENDERING STATE
    // ================================================================

    var mathCounter = 0;
    var mathStore = {};
    var mermaidStore = {};
    var mermaidCounter = 0;
    var lastRenderCache = null;

    // ================================================================
    //  UTILITY
    // ================================================================

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        var value = String(str);
        return HTML_ESCAPE_RE.test(value)
            ? value.replace(HTML_ESCAPE_RE, function (ch) { return HTML_ESCAPE_MAP[ch]; })
            : value;
    }

    function hasAttributionLink(text) {
        return ATTRIBUTION_LINK_RE.test(text || '');
    }

    function removeAttributionForAppPreview(text) {
        if (!text) return '';
        if (text.indexOf(ATTRIBUTION_LINK) === -1) return text;

        var withoutTrailingBlock = text.replace(ATTRIBUTION_TRAILING_BLOCK_RE, '');

        return withoutTrailingBlock
            .replace(ATTRIBUTION_LINE_RE, '')
            .replace(/\n{3,}/g, '\n\n')
            .trimEnd();
    }

    function cloneMathStore(store) {
        var clone = {};
        for (var id in store) {
            if (store.hasOwnProperty(id)) {
                clone[id] = {
                    tex: store[id].tex,
                    display: store[id].display
                };
            }
        }
        return clone;
    }

    function cloneMermaidStore(store) {
        var clone = {};
        for (var id in store) {
            if (store.hasOwnProperty(id)) {
                clone[id] = store[id];
            }
        }
        return clone;
    }

    // ================================================================
    //  MARKED CONFIGURATION
    // ================================================================

    function configureMarked() {
        var renderer = new marked.Renderer();

        // Headings with IDs for TOC
        renderer.heading = function (text, level, raw, slugger) {
            var id = slugger.slug(raw);
            return '<h' + level + ' id="' + escapeHtml(id) + '">' + text + '</h' + level + '>\n';
        };

        // Code blocks with copy button + mermaid/math
        renderer.code = function (code, language) {
            if (language === 'mermaid') {
                var id = 'mermaid-' + (mermaidCounter++);
                mermaidStore[id] = code;
                return '<div class="mermaid-block" data-mermaid-id="' + id + '"></div>';
            }

            var highlighted;
            var lang = language ? language.trim().split(/\s+/)[0] : '';
            if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
                try { highlighted = hljs.highlight(code, { language: lang }).value; }
                catch (e) { highlighted = escapeHtml(code); }
            } else {
                highlighted = escapeHtml(code);
            }

            return '<div class="code-block">'
                + '<div class="code-header">'
                + '<span class="code-lang">' + escapeHtml(lang) + '</span>'
                + '<button class="copy-btn" title="Copy code">Copy</button>'
                + '</div>'
                + '<pre><code class="hljs language-' + escapeHtml(lang || 'plaintext') + '">' + highlighted + '</code></pre>'
                + '</div>';
        };

        // Blockquotes with callout support
        renderer.blockquote = function (quote) {
            var calloutRe = /^<p>\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(?:<br\s*\/?>)?\n?\s*/i;
            var m = quote.match(calloutRe);
            if (m) {
                var type = m[1].toLowerCase();
                var body = quote.replace(m[0], '<p>');
                var icons = { note: 'ℹ️', tip: '💡', warning: '⚠️', important: '❗', caution: '🔴' };
                var labels = { note: 'Note', tip: 'Tip', warning: 'Warning', important: 'Important', caution: 'Caution' };
                return '<div class="callout callout-' + type + '">'
                    + '<div class="callout-title"><span class="callout-icon">' + icons[type] + '</span> ' + labels[type] + '</div>'
                    + '<div class="callout-body">' + body + '</div>'
                    + '</div>\n';
            }
            return '<blockquote>\n' + quote + '</blockquote>\n';
        };

        // Tables wrapped for scroll
        renderer.table = function (header, body) {
            return '<div class="table-wrapper"><table><thead>' + header + '</thead><tbody>' + body + '</tbody></table></div>';
        };

        // Links open in new tab
        renderer.link = function (href, title, text) {
            href = href || '#';
            var normalizedHref = href.trim();
            var isSafeHref = /^(https?:|mailto:|tel:|#|\/)/i.test(normalizedHref);
            var safeHref = isSafeHref ? normalizedHref : '#';
            var titleAttr = title ? ' title="' + escapeHtml(title) + '"' : '';
            var isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://');
            var target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
            return '<a href="' + escapeHtml(safeHref) + '"' + titleAttr + target + '>' + text + '</a>';
        };

        // Task list items
        renderer.listitem = function (text, task, checked) {
            if (task) {
                return '<li class="task-list-item">' + text + '</li>\n';
            }
            return '<li>' + text + '</li>\n';
        };

        marked.setOptions({
            renderer: renderer,
            gfm: true,
            breaks: false,
            smartypants: true,
            smartLists: true
        });
    }

    // ================================================================
    //  PREPROCESSORS
    // ================================================================

    function preprocessFootnotes(text) {
        if (text.indexOf('[^') === -1) return text;

        var footnotes = {};
        var index = 0;
        var withoutDefs = text.replace(FOOTNOTE_DEF_RE, function (match, id, content) {
            footnotes[id] = { content: content, index: ++index };
            return '';
        });
        if (index === 0) return text;

        var result = withoutDefs.replace(FOOTNOTE_REF_RE, function (match, id) {
            if (footnotes[id]) {
                return '<sup class="footnote-ref"><a href="' + FOOTNOTE_APP_PATH + '#fn-' + escapeHtml(id) + '" id="fnref-' + escapeHtml(id) + '">' + footnotes[id].index + '</a></sup>';
            }
            return match;
        });

        result += '\n\n<section class="footnotes"><hr><ol>';
        for (var id in footnotes) {
            if (footnotes.hasOwnProperty(id)) {
                result += '<li id="fn-' + escapeHtml(id) + '"><p>' + escapeHtml(footnotes[id].content) + ' <a href="' + FOOTNOTE_APP_PATH + '#fnref-' + escapeHtml(id) + '" class="footnote-backref">\u21a9</a></p></li>';
            }
        }
        result += '</ol></section>';
        return result;
    }

    function preprocessMath(text) {
        if (text.indexOf('$') === -1) return text;

        // Display math: $$...$$
        text = text.replace(DISPLAY_MATH_RE, function (match, tex) {
            var id = 'math-' + (mathCounter++);
            mathStore[id] = { tex: tex.trim(), display: true };
            return '<div class="math-display" data-math-id="' + id + '"></div>';
        });
        // Inline math: $...$
        text = text.replace(INLINE_MATH_RE, function (match, tex) {
            var id = 'math-' + (mathCounter++);
            mathStore[id] = { tex: tex, display: false };
            return '<span class="math-inline" data-math-id="' + id + '"></span>';
        });
        return text;
    }

    function preprocessEmoji(text) {
        if (text.indexOf(':') === -1) return text;

        return text.replace(EMOJI_RE, function (match) {
            return EMOJI_MAP[match] ? '<span class="emoji">' + EMOJI_MAP[match] + '</span>' : match;
        });
    }

    // ================================================================
    //  RENDER
    // ================================================================

    function renderMarkdown(source, options) {
        options = options || {};
        var safeSource = source || '';
        var cacheKey = (options.hideAttributionInApp ? '1' : '0') + '|' + safeSource;

        if (lastRenderCache && lastRenderCache.key === cacheKey) {
            mathCounter = lastRenderCache.mathCounter;
            mathStore = cloneMathStore(lastRenderCache.mathStore);
            mermaidStore = cloneMermaidStore(lastRenderCache.mermaidStore);
            mermaidCounter = lastRenderCache.mermaidCounter;
            return lastRenderCache.html;
        }

        mathCounter = 0;
        mathStore = {};
        mermaidStore = {};
        mermaidCounter = 0;

        var text = safeSource;
        if (options.hideAttributionInApp) {
            text = removeAttributionForAppPreview(text);
        }
        text = preprocessFootnotes(text);
        text = preprocessMath(text);
        text = preprocessEmoji(text);

        var rawHtml = marked.parse(text);

        var clean = DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['details', 'summary', 'mark', 'kbd', 'sup', 'sub', 'abbr'],
            ADD_ATTR: ['open', 'data-math-id', 'data-mermaid-id', 'disabled', 'checked', 'type']
        });

        lastRenderCache = {
            key: cacheKey,
            html: clean,
            mathCounter: mathCounter,
            mathStore: cloneMathStore(mathStore),
            mermaidStore: cloneMermaidStore(mermaidStore),
            mermaidCounter: mermaidCounter
        };

        return clean;
    }

    // ================================================================
    //  POST-PROCESSING (KaTeX & Mermaid)
    // ================================================================

    function postProcessPreview(container) {
        // KaTeX
        if (typeof katex !== 'undefined') {
            container.querySelectorAll('[data-math-id]').forEach(function (el) {
                var id = el.getAttribute('data-math-id');
                var entry = mathStore[id];
                if (entry) {
                    try {
                        el.innerHTML = katex.renderToString(entry.tex, {
                            displayMode: entry.display,
                            throwOnError: false,
                            output: 'htmlAndMathml'
                        });
                    } catch (e) {
                        el.textContent = entry.tex;
                        el.classList.add('math-error');
                    }
                }
            });
        }

        // Mermaid
        if (typeof mermaid !== 'undefined') {
            container.querySelectorAll('[data-mermaid-id]').forEach(function (el) {
                var id = el.getAttribute('data-mermaid-id');
                var code = mermaidStore[id];
                if (code) {
                    try {
                        var mermaidId = 'mmd-' + id;
                        mermaid.render(mermaidId, code).then(function (result) {
                            el.innerHTML = result.svg;
                        }).catch(function () {
                            el.innerHTML = '<div class="mermaid-error">Error rendering diagram</div>';
                        });
                    } catch (e) {
                        el.innerHTML = '<div class="mermaid-error">Error rendering diagram</div>';
                    }
                }
            });
        }
    }

    // ================================================================
    //  HTML → MARKDOWN CONVERSION
    // ================================================================

    function richHtmlToMarkdown(html) {
        var root = document.createElement('div');
        root.innerHTML = html;

        function childrenToMd(node) {
            var out = '';
            Array.prototype.forEach.call(node.childNodes, function (child) {
                out += nodeToMd(child);
            });
            return out;
        }

        function cleanInline(text) {
            return text.replace(/\u00a0/g, ' ');
        }

        function listItemToMd(liNode) {
            var checkbox = liNode.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.parentElement === liNode) checkbox.remove();
            var text = childrenToMd(liNode).trim();
            if (checkbox) {
                var mark = checkbox.checked ? '[x] ' : '[ ] ';
                text = mark + text;
            }
            return text.replace(/\n{2,}/g, '\n').split('\n').map(function (line, i) {
                return i === 0 ? line : '  ' + line;
            }).join('\n');
        }

        function tableToMd(tableNode) {
            var rows = Array.prototype.slice.call(tableNode.querySelectorAll('tr'));
            if (!rows.length) return '';

            var matrix = rows.map(function (row) {
                return Array.prototype.slice.call(row.querySelectorAll('th,td')).map(function (cell) {
                    return childrenToMd(cell).replace(/\n+/g, ' ').trim() || ' ';
                });
            });

            var cols = 0;
            matrix.forEach(function (r) { cols = Math.max(cols, r.length); });
            matrix = matrix.map(function (r) {
                while (r.length < cols) r.push(' ');
                return r;
            });

            var header = matrix[0];
            var divider = new Array(cols).fill('---');
            var body = matrix.slice(1);

            var lines = [];
            lines.push('| ' + header.join(' | ') + ' |');
            lines.push('| ' + divider.join(' | ') + ' |');
            body.forEach(function (r) {
                lines.push('| ' + r.join(' | ') + ' |');
            });
            return lines.join('\n') + '\n\n';
        }

        function nodeToMd(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return cleanInline(node.textContent || '');
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return '';

            var tag = node.tagName.toLowerCase();
            var inner = childrenToMd(node);

            if (tag === 'br') return '\n';
            if (tag === 'strong' || tag === 'b') return '**' + inner.trim() + '**';
            if (tag === 'em' || tag === 'i') return '*' + inner.trim() + '*';
            if (tag === 'u') return '<u>' + inner.trim() + '</u>';
            if (tag === 's' || tag === 'strike' || tag === 'del') return '~~' + inner.trim() + '~~';
            if (tag === 'code' && (!node.parentElement || node.parentElement.tagName.toLowerCase() !== 'pre')) {
                return '`' + (node.textContent || '').trim() + '`';
            }
            if (tag === 'a') {
                var href = node.getAttribute('href') || '';
                return '[' + (inner.trim() || href) + '](' + href + ')';
            }
            if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
                var level = parseInt(tag.slice(1), 10);
                return new Array(level + 1).join('#') + ' ' + inner.trim() + '\n\n';
            }
            if (tag === 'p') {
                var pText = inner.trim();
                return pText ? pText + '\n\n' : '';
            }
            if (tag === 'blockquote') {
                var quote = inner.trim();
                if (!quote) return '';
                return quote.split('\n').map(function (line) { return '> ' + line; }).join('\n') + '\n\n';
            }
            if (tag === 'ul') {
                var lines = [];
                Array.prototype.forEach.call(node.children, function (li) {
                    if (li.tagName && li.tagName.toLowerCase() === 'li') {
                        lines.push('- ' + listItemToMd(li));
                    }
                });
                return lines.join('\n') + (lines.length ? '\n\n' : '');
            }
            if (tag === 'ol') {
                var num = 1;
                var olLines = [];
                Array.prototype.forEach.call(node.children, function (li) {
                    if (li.tagName && li.tagName.toLowerCase() === 'li') {
                        olLines.push(num + '. ' + listItemToMd(li));
                        num += 1;
                    }
                });
                return olLines.join('\n') + (olLines.length ? '\n\n' : '');
            }
            if (tag === 'pre') {
                var code = node.textContent || '';
                var codeEl = node.querySelector('code');
                var lang = '';
                if (codeEl && codeEl.className) {
                    var m = codeEl.className.match(/language-([A-Za-z0-9_-]+)/);
                    if (m) lang = m[1];
                }
                return '```' + lang + '\n' + code.replace(/\n$/, '') + '\n```\n\n';
            }
            if (tag === 'hr') return '---\n\n';
            if (tag === 'img') {
                var src = node.getAttribute('src') || '';
                var alt = node.getAttribute('alt') || '';
                return '![' + alt + '](' + src + ')\n\n';
            }
            if (tag === 'table') return tableToMd(node);

            return inner;
        }

        var markdown = childrenToMd(root)
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return markdown;
    }

    // ================================================================
    //  PUBLIC API
    // ================================================================

    return {
        ATTRIBUTION_LINK: ATTRIBUTION_LINK,
        escapeHtml: escapeHtml,
        hasAttributionLink: hasAttributionLink,
        configureMarked: configureMarked,
        renderMarkdown: renderMarkdown,
        postProcessPreview: postProcessPreview,
        richHtmlToMarkdown: richHtmlToMarkdown
    };

})();
