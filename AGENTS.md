# AGENTS.md

Instructions for any AI coding agent working in this repo (Codex, Claude Code,
Cursor, Copilot, Gemini CLI, etc). Read this before editing.

## What this is

The personal website of Avighna Wuthoo. A static site with **no dependencies**,
**no framework**, and **no JavaScript on the page**. Stock Node 18+ is the only
requirement. There is no `node_modules`, no lockfile, and nothing to install.

## The one rule

**Edit `content.json`. Never edit `dist/`.**

`dist/` is generated output and is gitignored. Every file in it is overwritten
on each build. Edits there are silently destroyed.

```
content.json  ──┐
                ├── build.mjs ──> dist/  ──> GitHub Pages
src/style.css ──┘
```

`content.json` is the single source of truth for all page content. `build.mjs`
derives from it: `index.html` (with schema.org JSON-LD + OpenGraph), `index.md`,
`llms.txt`, `profile.json`, `sitemap.xml`, `robots.txt`, `ai.txt`, `humans.txt`,
`404.html`, and `CNAME`. They regenerate together so they can never disagree —
that is the entire point of the architecture. Do not introduce a second place
where content lives.

## Commands

```bash
npm run build    # content.json -> dist/
npm run check    # build, then run 46 structural assertions
npm run serve    # build, then serve dist/ at localhost:8000
```

## Before you commit

Run `npm run check`. It must pass with **0 failures**. CI runs the same command
and blocks the deploy on failure, so a broken build never reaches the live
domain — but catch it locally first.

Warnings are advisory (they mostly flag unfilled placeholder content). Failures
are not.

## Constraints — do not violate these

The checks in `check.mjs` enforce most of this. It exists so that an agent
unfamiliar with the project cannot quietly regress it.

- **No JavaScript on the page.** Crawlers that don't execute JS must still get
  the complete content. The only `<script>` permitted is `application/ld+json`.
- **No dependencies.** Do not add a `package.json` dependency, a bundler, or a
  static-site generator. If a task seems to need one, it doesn't.
- **No external subresources.** No CDN scripts, webfonts, or remote images. CSS
  is inlined into the HTML at build time. Absolute URLs in `rel="canonical"`,
  `rel="me"`, and `rel="alternate"` are correct and expected — those load nothing.
- **Keep it semantic.** Real `<main>`, `<section>`, `<h2>`, `<ul>`, `<li>`.
  No div soup. Machine-readability is the primary requirement of this site,
  ahead of visual polish.
- **Keep `robots.txt` permissive.** This site is meant to be crawled, indexed,
  and quoted. Never add a `Disallow` rule.
- **Preserve the aesthetic:** monospace, lowercase headings, terminal-like,
  minimal. Light and dark both via `prefers-color-scheme`. Page under ~15kb.

## Content authoring

Text fields in `content.json` support inline markdown: `[label](url)`,
`**bold**`, and `` `code` ``. Nothing else — the renderer in `build.mjs`
(`inlineHtml` / `inlineText`) handles exactly these three.

Sections render in file order. To add one, append to `sections`:

```json
{ "id": "projects", "title": "projects", "items": ["...", "..."] }
```

To remove one, delete the object. Fields left as `""` or `[]` are omitted from
the output rather than rendered empty.

Static assets go in `static/` and are copied to the site root verbatim, so
`static/resume.pdf` is served at `/resume.pdf`.

## Changing the domain

Set `domain` and `url` in `content.json` and rebuild. The `CNAME` file, the
canonical URL, the sitemap, and every absolute link regenerate from those two
fields. Do not hardcode the domain anywhere else.

## Deploy

Push to `main`. `.github/workflows/deploy.yml` builds, validates, and publishes
to GitHub Pages. Roughly 60 seconds. No manual deploy step.
