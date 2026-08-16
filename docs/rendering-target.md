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

**Implemented** via `remark-math` (delimiter parsing, in the pipeline) +
`rehype-mathjax/browser` (delimiter-wrapping only, in the pipeline) + a
real client-side MathJax runtime, loaded and invoked from `Preview.svelte`
after each render. Both `remark-math` and `rehype-mathjax` are from the
`remarkjs`/`rehypejs` org already anchoring this pipeline; the client
runtime is MathJax's own official `mathjax` npm package, using its
prebuilt `tex-svg.js` browser bundle (TeX input, SVG output).

### Dead end first: rehype-mathjax/chtml doesn't work in this app

The first implementation used `rehype-mathjax/chtml`, reasoning through a
bundle-size-vs-CDN-font tradeoff between it, `rehype-mathjax`'s SVG
default, and its `/browser` export (rejected at the time as "abandons the
pipeline-output model"). That reasoning turned out to rest on a false
premise, caught only after a real browser reproduced the crash the CHTML
version actually caused in production:

`rehype-mathjax`'s default/svg/chtml exports all wrap `mathjax-full`,
which is fundamentally a **Node-side renderer** — MathJax's own docs are
explicit that its Node integration path "is for node-based application
only, not for browser applications... This setup will not work properly
in the browser, even if you webpack it or bundle it in other ways."
`tsc --noEmit` and `npm run build` were both clean with chtml wired in,
and Node-based smoke tests (via `tsx`) all passed — none of that caught
it, because the failure only happens when the bundled code actually runs
in a browser. Opening the app in a real browser threw
`ReferenceError: require is not defined` inside the bundled
`mathjax-full` code and crashed the whole page.

This app renders markdown entirely client-side (`Preview.svelte` calls
`renderMarkdown()` directly in a `$effect`, no server round-trip for user
content) — there is no "build time" this pipeline runs at other than "in
the user's browser, live." That structurally rules out chtml/svg/default
for this app specifically, independent of whatever bundle-size/CDN-font
tradeoff they were originally being weighed on.

### What's actually implemented: rehype-mathjax/browser + a real client runtime

`rehype-mathjax/browser` (~1kb) does no rendering at all — per its own
source, it just wraps math source text in MathJax's runtime delimiters
(`\(...\)` inline, `\[...\]` display) as plain text. Actual typesetting
happens via MathJax's real client runtime (`tex-svg.js`), loaded once and
invoked with `MathJax.typesetPromise()` after each preview update, scoped
to just the preview container element. This is MathJax's own standard
client-integration pattern, not something improvised for this app.

`tex-svg.js` is vendored via a small Vite plugin (see `vite.config.ts`)
that copies it — and its `sre/` companion directory, needed for its
speech-worker/accessibility subsystem, confirmed by a real browser test
that omitting it left math rendering working but threw a console error
on every render — from `node_modules/mathjax` into `static/vendor/` at
build/dev-server start. Generated, not committed: a multi-megabyte set of
third-party files doesn't belong in git history, and generating it keeps
it in sync with whatever `mathjax` version is pinned in `package.json`.

SVG output (not CHTML) — this sidesteps the CDN-font-dependency tradeoff
entirely rather than accepting it. The original CHTML choice traded
bundle size for a font CDN dependency; since the real runtime now has to
be vendored and loaded as a dedicated script regardless of output mode,
there's no reason left to also accept a CDN dependency on top of that.
SVG output needs no external fonts at all, which is a strictly better fit
for this app's local-only pitch than the CHTML approach ever was — no
"accept now, close the gap with a service worker later" tradeoff needed.

Verified end-to-end with a real headless-browser test (not just Node
smoke tests, given what the chtml dead end taught): loads with no error,
typed math renders as genuine MathJax SVG output
(`<mjx-container jax="SVG">` containing real path data), and the
speech-worker fix confirmed working via `data-semantic-speech` /
`data-semantic-braille` attributes actually present in the output.

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

**Confirmed zero-cost when unused:** `Preview.svelte` only loads the
MathJax client runtime (~1.8MB, vendored — see above) when the rendered
HTML actually contains a `\(` or `\[` delimiter; documents without math
never trigger the script load or any typeset call. Confirmed by reading
the implementation directly, not assumed from the earlier (now-abandoned)
CHTML version's equivalent claim, which relied on a different mechanism
that no longer applies under this architecture.

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
