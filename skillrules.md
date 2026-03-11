# Rules for Writing a `SKILL.md` File

### Skill: Markdown Writing & Formatting Guide

## 1. Metadata rules (YAML frontmatter)

The file **must start with YAML metadata**.

Rules:

* Always place metadata at the very top.
* Only include metadata fields before the first `---`.
* The description must clearly state **when the skill should activate**.

Example:

```yaml
---
name: Markdown Writing Guide
description: Teach and enforce correct Markdown formatting for documents, notes, and documentation in [APP NAME]. Use when creating or editing markdown files.
---
```

Rules:

* `name` → human readable skill name (max 64 characters)
* `description` → what the skill does + when to use it
* description should include **trigger words**

Example trigger terms:

* markdown
* .md file
* documentation
* README
* formatting

Claude decides whether to activate the skill using this description. ([Firecrawl - The Web Data API for AI][2])

---

# 2. Core Sections to Include in the Markdown Body

The Markdown body contains **the actual instructions for the AI**.

Recommended structure:

```
# Overview
# When To Use This Skill
# Markdown Formatting Rules
# Document Structure Rules
# Formatting Standards
# App-Specific Rules
# Output Requirements
# Examples
# Common Mistakes
# Resources
```

---

# 3. Overview Section

Explain the purpose of the skill.

Example:

```
# Overview

This skill teaches the AI how to correctly write and format Markdown documents.
It ensures consistent formatting, readable structure, and compatibility with
[APP NAME].

The AI should follow these rules whenever producing Markdown content such as:

- documentation
- README files
- technical notes
- tutorials
- knowledge base articles
```

---

# 4. When to Use the Skill

Define **trigger conditions**.

Example:

```
# When to Use This Skill

Use this skill whenever:

- The user requests Markdown formatting
- The output should be a .md file
- Writing documentation or README files
- Converting text into Markdown
- Structuring notes or guides
```

Also define **when not to use it**.

---

# 5. Markdown Formatting Rules

Define strict markdown syntax rules.

Example:

```
# Markdown Formatting Rules

## Headings

Use the following hierarchy:

# H1 — Document title
## H2 — Major section
### H3 — Subsection
#### H4 — Minor subsection

Rules:
- Only one H1 per document
- Do not skip heading levels
```

---

## Lists

```
## Lists

Use bullet lists for unordered information.

- item
- item
- item

Use numbered lists for steps.

1. Step one
2. Step two
3. Step three
```

---

## Emphasis

```
## Text Formatting

Bold
**important text**

Italic
*emphasized text*

Inline code
`code`
```

---

## Code Blocks

````
## Code Blocks

Always use fenced code blocks.

Example:

```python
print("Hello")
````

```

---

# 6. Document Structure Rules

Define the correct **layout of markdown documents**.

Example:

```

# Document Structure Rules

A standard markdown document should follow this order:

1. Title
2. Overview
3. Table of contents (optional)
4. Main sections
5. Examples
6. Summary

```

---

# 7. Formatting Standards

Define readability rules.

Example:

```

# Formatting Standards

* Keep paragraphs under 4 lines
* Use whitespace between sections
* Prefer lists over long paragraphs
* Use headings every 200–300 words

```

---

# 8. App-Specific Rules

This section is **critical**.

Each Markdown app has differences.

Example for **Obsidian**

```

# Obsidian Specific Rules

Use double brackets for internal links:

[[Note Name]]

Use callouts:

> [!note]
> Important information

Tags:

#tag-name

```

Example for **GitHub Markdown**

```

# GitHub Markdown Rules

Use task lists:

* [ ] incomplete
* [x] complete

Use tables:

| Name    | Description |
| ------- | ----------- |
| Example | Text        |

```

---

# 9. Output Requirements

Tell the AI **how the final markdown should look**.

Example:

```

# Output Requirements

All responses must:

* be valid Markdown
* include headings
* use proper spacing
* avoid HTML unless required
* be readable in plain Markdown editors

```

---

# 10. Examples Section

Examples greatly improve skill performance.

Example:

```

# Examples

User request:
Create a README for a Python project.

Output structure:

# Project Name

## Overview

Description

## Installation

Steps

## Usage

Example code

## License

MIT

```

Examples help the model understand the expected structure.

---

# 11. Common Mistakes Section

Prevent typical errors.

Example:

```

# Common Mistakes

Avoid:

* skipping heading levels
* mixing tabs and spaces
* missing code block languages
* large unstructured paragraphs



---

# 12. Additional Files to Include

For a **Markdown skill**, the folder should include supporting files.

Recommended structure:

```

markdown-writing-skill/

SKILL.md
REFERENCE.md
EXAMPLES.md
TEMPLATES.md

```

These files are loaded **only when needed**, keeping context efficient. :contentReference[oaicite:2]{index=2}

---

### REFERENCE.md

Contains:

- full markdown syntax guide
- tables
- advanced formatting
- diagrams
- links

---

### EXAMPLES.md

Contains:

- README example
- tutorial example
- documentation example
- notes example

---

### TEMPLATES.md

Contains reusable templates:

```

README template
Blog template
Documentation template
Meeting notes template

```

---

# 13. Skill Design Rules

When writing the skill:

1. Keep `SKILL.md` under ~500 lines
2. Link to additional files instead of making one huge file
3. Use clear headings
4. Provide examples
5. Focus on **one workflow** (markdown writing)

Large skills should split content into reference files. :contentReference[oaicite:3]{index=3}

---

# 14. Optional Advanced Features

You may include:

```

scripts/
templates/
resources/

```

Example scripts:

- markdown validator
- table generator
- document formatter

---

# Example Skill Folder

```

markdown-writing/

SKILL.md
REFERENCE.md
EXAMPLES.md
TEMPLATES.md
resources/
scripts/

```

---

✅ **Summary**

A good Markdown skill should include:

- YAML metadata
- clear trigger conditions
- markdown syntax rules
- document structure rules
- app-specific formatting rules
- examples
- templates
- references

This ensures the AI consistently produces **clean, structured Markdown output**.




