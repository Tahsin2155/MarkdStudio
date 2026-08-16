# Rendering target: GitHub-exact, not generic GFM

Decided 2026-08-16. This supersedes the earlier "full GFM compliance" framing.

## The change

The rebuild's rendering target is no longer "spec-correct GitHub Flavored
Markdown" in the abstract. It's now: **match what github.com actually
renders**, including GitHub-specific extensions that go beyond the GFM
spec, and GitHub's specific raw-HTML allowlist rather than a generic
sanitize default.

This is a narrower and more concrete target than "full GFM" in some ways
(we don't need to chase edge cases the GFM spec permits but GitHub doesn't
actually render a certain way) and broader in others (GitHub-only syntax
that isn't part of the GFM spec at all).

## Math: MathJax, not KaTeX

v1 used KaTeX. That was a v1 choice, not a GitHub one.

GitHub's own math rendering uses **MathJax** (confirmed via GitHub Docs:
"GitHub's math rendering capability uses MathJax, an open source,
JavaScript-based display engine"). Delimiters match what's already assumed
elsewhere: inline `$...$`, block `$$...$$`.

**Implemented** via `remark-math` + `rehype-mathjax/chtml`, both from the
`remarkjs`/`rehypejs` org already anchoring this pipeline.

Output mode is **CHTML**, not `rehype-mathjax`'s default (SVG). Real
tradeoff, decided deliberately:
- SVG: ~566kb, fully self-contained, no network dependency per render.
- CHTML (chosen): ~154kb (confirmed in the actual production client
  bundle: the mathjax chunk is the single largest chunk, ~293kb
  unminified / ~95kb gzipped — in the right ballpark), but **requires
  `fontURL`**, a CDN font URL (jsdelivr's MathJax mirror) fetched at
  render time.
- Browser mode (`rehype-mathjax/browser`, ~1kb): rejected — it pushes
  actual rendering to a separate client-side MathJax pass rather than
  being pipeline output, abandoning the "math is just more unified
  output" model this pipeline already uses for alerts/highlighting/etc.

**Accepted tradeoff:** CHTML's CDN font dependency is a genuine, temporary
regression to this app's "local-only, no signup" pitch (IndexedDB-only,
no server) — documents with math won't render correctly offline until
the fonts are cached. **Decided:** accept this now; close the gap later
via a service worker caching the font requests. PWA/service-worker work
is already a v2+ item in v2-roadmap.md Phase 4 — this doesn't pull that
item forward, it just adds "also caches MathJax CHTML fonts" to what that
future work needs to cover.

**Known gap, not fixed:** GitHub also supports an alternate inline math
delimiter, `` $`...`$ ``, specifically to avoid ambiguity between math and
literal dollar signs in prose (GitHub's own docs describe this as the fix
for exactly that ambiguity). `remark-math` has no equivalent — it follows
CommonMark's code-span conventions with `$` swapped in for backticks, and
there's no config option for GitHub's hybrid syntax. Confirmed by direct
test: prose like "the price is $5 to $10" gets misinterpreted as inline
math (`5t` and `o` get consumed into a math node), and `` $`...`$ `` is
left as literal backtick text rather than parsed as math at all. This
matches a real, known quirk from when GitHub first shipped math support
(plain-`$` has the same price-text ambiguity there too), so it's not a
worse mismatch than GitHub's own actual behavior — but GitHub's own
escape hatch for it isn't implemented here. **Decided:** ship as-is
(plain `$`/`$$` only) rather than hand-roll a custom remark plugin for
the backtick variant or disable single-`$` math and diverge from GitHub's
actual default.

**Confirmed zero-cost when unused:** by reading `rehype-mathjax`'s
implementation, the stylesheet/font-face block is only appended to the
tree `if (found)` — i.e. only when the document actually contains math.
Documents without math pay no rendering cost and inject no MathJax
markup at all. Verified by direct test.

## GitHub Alerts (callouts): in scope

`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`
are a GitHub-specific blockquote extension, not part of core GFM. Under
the old "GFM compliance" framing these were arguably out of scope; under
"match GitHub" they're in scope, since they're part of what GitHub
actually renders.

Implementation: use `rehype-github-alert` from the `rehypejs/rehype-github`
suite (https://github.com/rehypejs/rehype-github), not a third-party
alternative. This suite is maintained by the `rehypejs`/`remarkjs` org
itself — the same org whose packages (`unified`, `remark-gfm`,
`remark-rehype`) already anchor this project's pipeline — and is
explicitly built to match GitHub's actual transforms, not just visual
approximation.

**Decided:** adopt `rehype-github-alert` only, for now. The suite has
sibling plugins closing similar gaps — `rehype-github-emoji` (`:emoji:`
shortcodes), `rehype-github-heading` (heading-anchor behavior),
`rehype-github-image` (image handling) — deliberately deferred to
**v2.1+**, not this change. Keeping this change scoped to alerts only.

Note: `rehype-github-alert` expects to run after `rehype-raw` in the
pipeline (since it operates on the raw blockquote HTML), per the suite's
example pipeline: remark-parse → remark-gfm → remark-rehype
(allowDangerousHtml) → rehype-raw → rehype-github-alert → ... →
rehype-sanitize → rehype-stringify. rehype-sanitize must come *after*
rehype-github-alert so the alert markup survives sanitization, and its
schema (see below) needs to permit whatever classes/structure the alert
plugin emits, not just GitHub's raw-content allowlist.

## Raw HTML allowlist: GitHub's exact list, not a generic sanitize schema

The rebuild currently uses `rehype-sanitize` with (implicitly) a generic
safe-HTML default schema. GitHub's actual allowlist, per GitHub's
sanitization filter, is:

```
a abbr dfn b strong bdo br cite q code pre blockquote del ins
details summary div dl dd dt figure caption figcaption
h1 h2 h3 h4 h5 h6 h7 h8 hr i em img kbd samp mark
ol ul li p ruby rt rp s strike small span sup sub
table tbody tfoot thead td th tr time tt var wbr
```

Everything else (script, style, iframe, on* attributes, inline `style=`,
`class`/`id` on arbitrary elements, etc.) is stripped. Notes from GitHub's
own docs on this list:
- `kbd` and `samp` render the same as `code`
- `var` renders the same as `i`/`em`
- `tt` and `strike` aren't valid HTML5 but GitHub still allows them
  (equivalent to `code`/`kbd`/`samp` and `del`/`s` respectively)
- inline `style` attributes (e.g. `<span style="color:blue">`) do **not**
  work on GitHub even though `span` itself is allowed

Action: build a custom `rehype-sanitize` schema matching this list exactly,
rather than relying on the default schema. This directly affects which
raw-HTML passthrough features (kbd, mark, sup/sub, details/summary, etc.)
actually render vs. get stripped.

## Deferred within the GitHub-suite family (v2.1+)

The `rehype-github-alert` decision above surfaced sibling plugins from
the same `rehypejs/rehype-github` suite that close analogous "GitHub does
X, we don't" gaps:
- `rehype-github-emoji` — `:emoji:` shortcode rendering
- `rehype-github-heading` — GitHub's heading-anchor link behavior
- `rehype-github-image` — GitHub's image-handling transforms

Explicitly deferred to v2.1+, not this rendering-fidelity change. Noted
here so they aren't forgotten and don't need re-discovering later.

## What this pivot does NOT imply

Multi-theme system (5 reading themes in v1), the four editing modes
(Split/Write/Preview/Inline WYSIWYG), and the dynamic table-of-contents
with scroll tracking are **product/UX decisions**, not rendering-fidelity
ones. The GitHub-match pivot doesn't resolve those — they're still open
and tracked separately (see v2-roadmap.md Phase 2/4 status, pending
updates to reflect this session's decisions).

## v1 scope additions (this session)

Two items move from "deferred to v2" into v1 scope:
- **Landing page** — new design, not a port of v1's landing page (v1's
  page advertises features — 5 themes, PDF/HTML export, Mermaid — that
  aren't all planned for this rebuild, so copying it verbatim would
  overpromise).
- **Math rendering** — MathJax, per above, in place of the old "KaTeX,
  deferred to v2" line.

Mermaid, PDF export, HTML export, and the multi-theme system remain
deferred (unchanged from the prior agreement).
