# Markdown Feature Test Suite

This document is designed to exercise the markdown features supported by this app: GitHub Flavored Markdown, raw HTML, task lists, alerts, tables, footnotes, and math.

---

## 1) Headings

# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading

---

## 2) Text formatting

This is normal text.

This is **bold**, *italic*, and ***bold italic***.

This is ~~strikethrough~~ text.

This is ==highlighted== text.

This text contains a line break.
This is a second line in the same paragraph.

---

## 3) Lists

### Unordered list

- Item one
- Item two
  - Nested item A
  - Nested item B
- Item three

### Ordered list

1. First item
2. Second item
3. Third item
   1. Nested first
   2. Nested second

### Task list

- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task with nested item
  - [ ] Subtask

---

## 4) Blockquotes

> This is a blockquote.
>
> > This is a nested blockquote.

> [!NOTE]
> This is a quote-style note block.

---

## 5) Links and images

Autolink: https://example.com

Regular link: [MarkdStudio](https://example.com)

Reference link: [Docs][docs-link]

[docs-link]: https://example.com/docs

Image:

![Example mountain](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80)

---

## 6) Tables

| Feature | Status | Notes |
| --- | --- | --- |
| Headings | ✅ | Works |
| Tables | ✅ | GFM table syntax |
| Task lists | ✅ | Checkbox rendering |
| Raw HTML | ✅ | Allowed with sanitizer |
| Math | ✅ | MathJax enabled |

A second example with alignment:

| Left | Center | Right |
| :--- | :---: | ---: |
| One | Two | Three |
| Four | Five | Six |

---

## 7) Code blocks and inline code

Inline code: `npm run dev`

Fenced code block:

```ts
const message = 'Hello, Markdown!';
console.log(message);
```

Python example:

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

HTML example:

```html
<div class="card">
  <h3>Card</h3>
</div>
```

---

## 8) HTML and inline elements

This sentence contains <mark>highlighted</mark> text.

Use <kbd>Ctrl</kbd> + <kbd>C</kbd> to copy.

A <sub>subscript</sub> example and a <sup>superscript</sup> example.

<details>
<summary>Click to expand</summary>

This content is inside a details/summary block.
It should render as a collapsible section.

</details>

<br />

<abbr title="HyperText Markup Language">HTML</abbr> is a markup language.

---

## 9) Alerts (GitHub-style)

> [!NOTE]
> This is a note alert.

> [!TIP]
> This is a helpful tip alert.

> [!IMPORTANT]
> This is an important alert.

> [!WARNING]
> This is a warning alert.

> [!CAUTION]
> This is a caution alert.

---

## 10) Math

Inline math: The equation $E = mc^2$ is famous.

Display math:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

Another display block:

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
$$

---

## 11) Footnotes

This sentence has a footnote.[^1]

Another sentence with a second footnote.[^2]

[^1]: This is the first footnote.
[^2]: This is the second footnote with more explanation.

---

## 12) Escapes and special characters

This is a literal asterisk: \*not italic\*

This is a literal underscore: \_not emphasized\_

Escaped pipe: \|

Backslash example: C:\\Users\\Name

---

## 13) Horizontal rule and separators

Before rule.

---

After rule.

---

## 14) Sanitization / raw HTML safety test

This should be sanitized away:

<script>alert('This should not run');</script>

This should remain visible:

<p>This raw HTML paragraph is allowed by the app’s sanitizer.</p>

---

## 15) Reference-style definition list simulation

Term 1
: Definition for term 1.

Term 2
: Definition for term 2, which can be more verbose.

---

## 16) Mixed content checklist

- [x] headings
- [x] emphasis
- [x] links
- [x] images
- [x] lists
- [x] tables
- [x] code blocks
- [x] inline code
- [x] HTML
- [x] alerts
- [x] math
- [x] footnotes
- [x] sanitization checks

This file should render cleanly in the live preview and is useful as a smoke test for markdown regressions.
