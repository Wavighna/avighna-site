# avighnawuthoo.com

Personal site. Static, zero dependencies, no JavaScript, ~9kb.

**You edit one file: [`content.json`](content.json).** Everything else is generated.

```bash
npm run serve    # build + preview at localhost:8000
npm run check    # build + validate (run before pushing)
npm run build    # build only, into dist/
```

---

## How it works

```
content.json  ──┐
                ├── build.mjs ──> dist/   (deployed to GitHub Pages)
src/style.css ──┘
```

One source of truth means the human-readable page and every machine-readable
mirror can never disagree. Change a bullet in `content.json`, and the HTML,
the Markdown, the plain text, and the JSON all update together.

Generated into `dist/`:

| file | who reads it |
|---|---|
| `index.html` | people, Google, and any crawler — semantic HTML + JSON-LD + OpenGraph |
| `index.md` | AI agents that prefer Markdown; linked via `<link rel="alternate">` |
| `llms.txt` | LLMs — the [llmstxt.org](https://llmstxt.org) convention, full content in plain text |
| `profile.json` | anything programmatic — full content as structured JSON |
| `robots.txt` | crawlers — names and allows all 27 major AI + search bots |
| `sitemap.xml` | search engines |
| `ai.txt` | the [spawning.ai](https://site.spawning.ai/spawning-ai-txt) convention — explicit training permission |
| `humans.txt` | people, the old-fashioned way |

### Why this makes you legible to AI

Most personal sites lose to three failure modes. This one avoids all three:

1. **JS-rendered content.** Many crawlers don't execute JavaScript, so they
   index an empty shell. This site has none — `curl` returns the complete page.
2. **No structured data.** Without schema.org markup, a model has to guess
   which words are your job and which are your name. The JSON-LD `Person`
   graph states it outright.
3. **Content buried in layout.** Nested `<div>` soup is hard to extract from.
   Here the content is real `<h2>`, `<ul>`, `<li>`, `<main>`, `<section>` —
   and, failing that, there's a plain-text mirror at `/llms.txt`.

`npm run check` enforces all of this — 46 structural assertions covering
JSON-LD validity, meta tags, crawler directives, internal links, and page
weight. CI runs it on every push, so a broken build never reaches the domain.

### Adding a resume or images

Drop files in `static/` — they're copied into `dist/` verbatim.
`static/resume.pdf` becomes `avighnawuthoo.com/resume.pdf`.

---

## Deploying

### 1. Push to GitHub

```bash
gh repo create avighna-site --public --source=. --push
```

No `gh`? Create an empty repo on github.com, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/avighna-site.git
git push -u origin main
```

### 2. Turn on Pages

Repo → **Settings** → **Pages** → **Source: GitHub Actions**.

The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
builds, validates, and publishes on every push to `main`. First deploy takes
about a minute; the site is then live at `YOUR_USERNAME.github.io/avighna-site`.

### 3. Point the domain at it

Buy `avighnawuthoo.com` (~$12/yr) — Cloudflare Registrar sells at wholesale
with no markup and no upsells; Namecheap and Porkbun are also fine. Then add
these DNS records at the registrar:

| type | name | value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `YOUR_USERNAME.github.io` |

If your registrar supports IPv6, add these AAAA records on `@` too:
`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`,
`2606:50c0:8003::153`.

Then: repo → **Settings** → **Pages** → **Custom domain** → `avighnawuthoo.com`
→ Save, and tick **Enforce HTTPS** once the certificate is issued (a few
minutes, occasionally up to an hour).

> Using a domain other than `avighnawuthoo.com`? Change `domain` and `url` in
> `content.json` and rebuild — the `CNAME` file, canonical URL, sitemap, and
> all absolute links regenerate from those two fields.

### 4. Get indexed

Once it's live:

- Submit `https://avighnawuthoo.com/sitemap.xml` to
  [Google Search Console](https://search.google.com/search-console) and
  [Bing Webmaster Tools](https://www.bing.com/webmasters) — Bing's index feeds
  ChatGPT search, so it's worth the five minutes.
- Link the domain from your GitHub profile, LinkedIn, and X. Crawlers find new
  domains by following links, and those three are all crawled constantly.
- Check it renders: [Rich Results Test](https://search.google.com/test/rich-results)
  validates the JSON-LD, and `curl https://avighnawuthoo.com/llms.txt` confirms
  the plain-text mirror is live.
