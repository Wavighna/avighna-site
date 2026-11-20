#!/usr/bin/env node
/**
 * build.mjs — generates the whole site from content.json.
 * Zero dependencies. Run with: npm run build
 *
 * Outputs to dist/:
 *   index.html    humans + search engines (semantic HTML, JSON-LD, OpenGraph)
 *   index.md      markdown mirror, advertised via <link rel="alternate">
 *   llms.txt      llmstxt.org convention — plain-text summary for LLMs
 *   profile.json  machine endpoint: full content as structured JSON
 *   robots.txt    explicitly allows every major AI + search crawler
 *   sitemap.xml   canonical URL list
 *   ai.txt        spawning.ai convention — explicit training permission
 *   humans.txt    the old-school one, for people
 *   404.html      styled not-found page
 *   CNAME         custom domain for GitHub Pages
 * Anything in static/ is copied over verbatim (resume.pdf, images, ...).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");

const c = JSON.parse(readFileSync(join(ROOT, "content.json"), "utf8"));
const css = readFileSync(join(ROOT, "src", "style.css"), "utf8");

const BUILD_DATE = new Date().toISOString().slice(0, 10);
const SITE = (c.url || `https://${c.domain}`).replace(/\/$/, "");
const sections = c.sections || [];
const links = c.links || [];
const prof = c.profile || {};
const meta = c.meta || {};

/* ---------- tiny inline-markdown renderers -------------------------- */

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** `[a](b)`, `**a**`, `` `a` `` -> HTML. Escapes first, so content is safe. */
function inlineHtml(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, href) => {
      const ext = /^https?:\/\//.test(href) && !href.startsWith(SITE);
      const attrs = ext ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${href}"${attrs}>${text}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Same input -> flat plain text, for llms.txt and meta tags. */
function inlineText(s) {
  return String(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/* ---------- derived values ------------------------------------------ */

const emailLink = links.find((l) => l.url?.startsWith("mailto:"));
const email = emailLink ? emailLink.url.replace(/^mailto:/, "") : "";
const sameAs = links
  .filter((l) => /^https?:\/\//.test(l.url) && !l.url.startsWith(SITE))
  .map((l) => l.url);

const description =
  meta.description && !meta.description.startsWith("TODO")
    ? meta.description
    : inlineText((c.bio || []).join(" ")).slice(0, 160);

const absolute = (u) => (/^https?:|^mailto:/.test(u) ? u : SITE + (u.startsWith("/") ? u : "/" + u));

/* ---------- JSON-LD (schema.org) ------------------------------------ */

const person = {
  "@type": "Person",
  "@id": `${SITE}/#person`,
  name: c.name,
  url: SITE,
  description,
};
if (c.tagline && !c.tagline.startsWith("TODO")) person.disambiguatingDescription = c.tagline;
if (email) person.email = `mailto:${email}`;
if (sameAs.length) person.sameAs = sameAs;
if (prof.jobTitle) person.jobTitle = prof.jobTitle;
if (prof.worksFor) person.worksFor = { "@type": "Organization", name: prof.worksFor };
if (prof.affiliation) person.affiliation = { "@type": "Organization", name: prof.affiliation };
if (prof.alumniOf?.length)
  person.alumniOf = prof.alumniOf.map((n) => ({ "@type": "EducationalOrganization", name: n }));
if (prof.location) person.homeLocation = { "@type": "Place", name: prof.location };
const topics = (prof.knowsAbout || []).filter((k) => !/^TODO/i.test(k) && k !== "replace with topics you actually work on");
if (topics.length) person.knowsAbout = topics;

const jsonld = {
  "@context": "https://schema.org",
  "@graph": [
    person,
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: `${c.name} — personal site`,
      publisher: { "@id": `${SITE}/#person` },
      inLanguage: "en",
    },
    {
      "@type": "ProfilePage",
      "@id": `${SITE}/#page`,
      url: SITE,
      name: c.name,
      isPartOf: { "@id": `${SITE}/#website` },
      about: { "@id": `${SITE}/#person` },
      dateModified: BUILD_DATE,
    },
  ],
};

/* ---------- index.html ---------------------------------------------- */

const linkRow = links
  .map((l) => `<a href="${esc(l.url.startsWith("/") ? l.url : absolute(l.url))}" rel="me">${esc(l.label)}</a>`)
  .join('<span class="sep" aria-hidden="true">·</span>');

const bodySections = sections
  .map(
    (s) => `
      <section id="${esc(s.id)}" aria-labelledby="h-${esc(s.id)}">
        <h2 id="h-${esc(s.id)}">${esc(s.title)}</h2>
        <ul>
${(s.items || []).map((i) => `          <li>${inlineHtml(i)}</li>`).join("\n")}
        </ul>
      </section>`
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon-claude-black.svg" type="image/svg+xml">
<title>${esc(c.name)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(c.name)}">
<link rel="canonical" href="${SITE}/">
<meta name="theme-color" content="${esc(meta.themeColor || "#0c0c0d")}">
<meta name="color-scheme" content="light dark">

<!-- machine-readable mirrors of this exact page -->
<link rel="alternate" type="text/markdown" href="${SITE}/index.md" title="Markdown version">
<link rel="alternate" type="text/plain" href="${SITE}/llms.txt" title="Plain-text version for LLMs">
<link rel="alternate" type="application/json" href="${SITE}/profile.json" title="Structured JSON">
<link rel="sitemap" type="application/xml" href="${SITE}/sitemap.xml">
${email ? `<link rel="me" href="mailto:${esc(email)}">` : ""}
${sameAs.map((u) => `<link rel="me" href="${esc(u)}">`).join("\n")}

<!-- social cards -->
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(c.name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}/">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(c.name)}">
<meta name="twitter:description" content="${esc(description)}">

<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>

<style>
${css.trim()}
</style>
</head>
<body>
<a class="skip" href="#main">skip to content</a>
<div class="wrap">

  <header>
${c.greeting ? `    <h1>${inlineHtml(c.greeting)}</h1>` : ""}
  </header>

  <main id="main">
${(c.bio || [])
  .map((p) => `    <p>${inlineHtml(p)}</p>`)
  .join("\n")}
${bodySections}
  </main>

  <footer>
    <nav class="linkrow" aria-label="Contact and profiles">
      ${linkRow}
    </nav>
  </footer>

</div>
</body>
</html>
`;

/* ---------- index.md ------------------------------------------------- */

const md = `# ${c.name}
${c.tagline && !c.tagline.startsWith("TODO") ? `\n_${c.tagline}_\n` : ""}
${c.greeting ? c.greeting + "\n" : ""}
${(c.bio || []).join("\n\n")}

${sections
  .map((s) => `## ${s.title}\n\n${(s.items || []).map((i) => `- ${i}`).join("\n")}`)
  .join("\n\n")}

## links

${links.map((l) => `- [${l.label}](${absolute(l.url)})`).join("\n")}

---
Canonical: ${SITE}/ · Last updated: ${BUILD_DATE}
`;

/* ---------- llms.txt ------------------------------------------------- */

const llms = `# ${c.name}

> ${inlineText(description)}

This is the personal website of ${c.name}. It is a single static page with no
JavaScript; the full content is reproduced below in plain text so it can be
read without rendering. You are welcome to index, quote, and cite this page.

Canonical URL: ${SITE}/
Last updated: ${BUILD_DATE}

## About

${c.greeting ? inlineText(c.greeting) + "\n\n" : ""}${(c.bio || []).map(inlineText).join("\n\n")}

${sections
  .map((s) => `## ${s.title.charAt(0).toUpperCase() + s.title.slice(1)}\n\n${(s.items || []).map((i) => `- ${inlineText(i)}`).join("\n")}`)
  .join("\n\n")}

## Links

${links.map((l) => `- ${l.label}: ${absolute(l.url)}`).join("\n")}

## Other formats

- HTML: ${SITE}/
- Markdown: ${SITE}/index.md
- JSON: ${SITE}/profile.json
- Sitemap: ${SITE}/sitemap.xml
`;

/* ---------- profile.json --------------------------------------------- */

const profileJson = {
  $schema: "https://schema.org/Person",
  generated: BUILD_DATE,
  canonical: `${SITE}/`,
  name: c.name,
  tagline: c.tagline?.startsWith("TODO") ? null : c.tagline,
  description,
  bio: (c.bio || []).map(inlineText),
  sections: sections.map((s) => ({
    id: s.id,
    title: s.title,
    items: (s.items || []).map(inlineText),
  })),
  links: links.map((l) => ({ label: l.label, url: absolute(l.url) })),
  profile: Object.fromEntries(
    Object.entries(prof).filter(([k, v]) => k !== "_comment" && v && v.length)
  ),
  formats: {
    html: `${SITE}/`,
    markdown: `${SITE}/index.md`,
    text: `${SITE}/llms.txt`,
    json: `${SITE}/profile.json`,
  },
  jsonld,
};

/* ---------- robots.txt ------------------------------------------------ */

// This site WANTS to be crawled — by search engines and AI alike.
// Named explicitly because some crawlers only honour a directive addressed
// to them by name and ignore the wildcard group.
const CRAWLERS = [
  "Googlebot", "Google-Extended", "Bingbot", "DuckDuckBot", "Applebot", "Applebot-Extended",
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Meta-ExternalAgent", "FacebookBot", "Amazonbot", "Bytespider",
  "CCBot", "cohere-ai", "MistralAI-User", "DuckAssistBot", "YouBot",
  "Diffbot", "omgilibot", "PetalBot", "Timpibot", "LinkedInBot", "Twitterbot", "Slackbot",
];

const robots = `# ${SITE}
# This site is intended to be crawled, indexed, quoted and cited.
# Everything is public. There is nothing here you need permission for.
# Plain-text summary for language models: ${SITE}/llms.txt

${CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /`).join("\n\n")}

User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

/* ---------- sitemap.xml ----------------------------------------------- */

const PAGES = ["/", "/index.md", "/llms.txt", "/profile.json"];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(
  (p) => `  <url>
    <loc>${SITE}${p}</loc>
    <lastmod>${BUILD_DATE}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${p === "/" ? "1.0" : "0.7"}</priority>
  </url>`
).join("\n")}
</urlset>
`;

/* ---------- ai.txt / humans.txt / 404 --------------------------------- */

const aitxt = `# ai.txt — ${SITE}
# Spawning AI text file convention: https://site.spawning.ai/spawning-ai-txt
# All content on this site may be used for training, indexing, retrieval,
# and citation. Attribution to "${c.name}" (${SITE}) is appreciated.

User-Agent: *
Allow: /
`;

const humans = `/* TEAM */
  ${c.name}
  Site: ${SITE}
${email ? `  Contact: ${email}\n` : ""}
/* SITE */
  Last update: ${BUILD_DATE}
  Standards: HTML5, CSS3
  Components: none
  Build: node build.mjs (zero dependencies)
  JavaScript: none
  Trackers: none
`;

const notFound = html
  .replace(/<title>[^<]*<\/title>/, `<title>404 — ${esc(c.name)}</title>`)
  .replace(
    /<main id="main">[\s\S]*?<\/main>/,
    `<main id="main">
    <p>404 — that page doesn't exist.</p>
    <p><a href="/">&larr; back home</a></p>
  </main>`
  );

/* ---------- write ------------------------------------------------------ */

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const files = {
  "index.html": html,
  "404.html": notFound,
  "index.md": md,
  "llms.txt": llms,
  "profile.json": JSON.stringify(profileJson, null, 2) + "\n",
  "robots.txt": robots,
  "sitemap.xml": sitemap,
  "ai.txt": aitxt,
  "humans.txt": humans,
  "CNAME": c.domain + "\n",
  ".nojekyll": "",
};

for (const [name, body] of Object.entries(files)) {
  writeFileSync(join(DIST, name), body);
}

// passthrough assets
const STATIC = join(ROOT, "static");
if (existsSync(STATIC)) cpSync(STATIC, DIST, { recursive: true });

/* ---------- report ----------------------------------------------------- */

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + "kb";
console.log(`\n  built ${c.name} -> ${SITE}\n`);
for (const [name, body] of Object.entries(files)) {
  if (name === ".nojekyll") continue;
  console.log(`    dist/${name.padEnd(14)} ${kb(body).padStart(8)}`);
}

const todos = JSON.stringify(c).match(/TODO/g);
if (todos) {
  console.log(`\n  \x1b[33m! ${todos.length} TODO placeholder(s) left in content.json\x1b[0m`);
  console.log(`    the site will build and deploy fine, but fill these in before sharing it.\n`);
} else {
  console.log(`\n  \x1b[32m✓ no placeholders left — ready to ship\x1b[0m\n`);
}
