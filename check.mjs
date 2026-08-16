#!/usr/bin/env node
/**
 * check.mjs — validates dist/ before you ship it.
 * Run with: npm run check
 *
 * Catches the things that silently break machine-readability:
 * malformed JSON-LD, missing meta tags, broken internal links,
 * a robots.txt that forgot the sitemap, leftover placeholders.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "dist");
const read = (f) => readFileSync(join(DIST, f), "utf8");

let pass = 0;
const fails = [];
const warns = [];

const ok = (label, cond, detail = "") => {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  else { fails.push(label + (detail ? ` — ${detail}` : "")); console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`); }
};
const warn = (label, cond, detail = "") => {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  else { warns.push(label); console.log(`  \x1b[33m!\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`); }
};

console.log("\n  files\n");

const REQUIRED = [
  "index.html", "404.html", "index.md", "llms.txt", "profile.json",
  "robots.txt", "sitemap.xml", "ai.txt", "humans.txt", "CNAME",
];
for (const f of REQUIRED) ok(`dist/${f}`, existsSync(join(DIST, f)));

if (fails.length) {
  console.log("\n  \x1b[31mmissing files — run `npm run build` first\x1b[0m\n");
  process.exit(1);
}

const html = read("index.html");

console.log("\n  html + metadata\n");

ok("doctype + lang attribute", /<!doctype html>/i.test(html) && /<html lang="[a-z-]+"/i.test(html));
ok("viewport meta", /name="viewport"/.test(html));
ok("title tag", /<title>[^<]{1,70}<\/title>/.test(html));
ok("meta description", /name="description" content="[^"]{20,}"/.test(html), "needs 20+ chars");
ok("canonical url", /rel="canonical"/.test(html));
ok("opengraph tags", /property="og:title"/.test(html) && /property="og:description"/.test(html));
ok("semantic landmarks", /<main/.test(html) && /<header/.test(html) && /<footer/.test(html));
ok("skip-to-content link", /class="skip"/.test(html));
// Only flag tags that actually trigger a network fetch. Absolute URLs in
// rel=canonical / rel=me / rel=alternate are correct by spec and load nothing.
const subresources = [
  ...html.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"/gi),
  ...html.matchAll(/<(?:img|iframe|video|audio|source)[^>]+src="(https?:\/\/[^"]+)"/gi),
  ...html.matchAll(/<link[^>]+rel="(?:stylesheet|preload|preconnect|prefetch|dns-prefetch)"[^>]*href="(https?:\/\/[^"]+)"/gi),
  ...html.matchAll(/url\(\s*['"]?(https?:\/\/[^)'"]+)/gi),
].map((m) => m[1]);
ok("no external subresources", subresources.length === 0,
   subresources.length ? `must be inlined: ${subresources.join(", ")}` : "");
warn("no javascript", !/<script(?![^>]*application\/ld\+json)/i.test(html));

console.log("\n  structured data\n");

const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
ok("json-ld block present", !!ld);
let graph = [];
if (ld) {
  try {
    const parsed = JSON.parse(ld[1]);
    graph = parsed["@graph"] || [parsed];
    ok("json-ld parses as valid json", true);
    ok("schema.org context", parsed["@context"] === "https://schema.org");
    const person = graph.find((n) => n["@type"] === "Person");
    ok("Person node", !!person);
    ok("Person has name + url", !!(person?.name && person?.url));
    warn("Person has sameAs profiles", !!person?.sameAs?.length, "add github/linkedin links");
    warn("Person has knowsAbout topics", !!person?.knowsAbout?.length, "helps AI answer topical queries");
    warn("Person has jobTitle", !!person?.jobTitle);
    ok("WebSite node", !!graph.find((n) => n["@type"] === "WebSite"));
    ok("ProfilePage node", !!graph.find((n) => n["@type"] === "ProfilePage"));
  } catch (e) {
    ok("json-ld parses as valid json", false, e.message);
  }
}

console.log("\n  machine-readable mirrors\n");

const profile = JSON.parse(read("profile.json"));
ok("profile.json parses", !!profile.name);
ok("profile.json has content", (profile.bio || []).join("").length > 0);
ok("markdown mirror advertised", /rel="alternate" type="text\/markdown"/.test(html));
ok("llms.txt advertised", /rel="alternate" type="text\/plain"/.test(html));
ok("json advertised", /rel="alternate" type="application\/json"/.test(html));

const llms = read("llms.txt");
ok("llms.txt has h1 + blockquote summary", /^# /m.test(llms) && /^> /m.test(llms));
ok("llms.txt states canonical url", /Canonical URL: https?:\/\//.test(llms));

const robots = read("robots.txt");
ok("robots.txt references sitemap", /^Sitemap: https?:\/\//m.test(robots));
ok("robots.txt allows GPTBot", /User-agent: GPTBot\nAllow: \//.test(robots));
ok("robots.txt allows ClaudeBot", /User-agent: ClaudeBot\nAllow: \//.test(robots));
ok("robots.txt allows Googlebot", /User-agent: Googlebot\nAllow: \//.test(robots));
ok("robots.txt has no Disallow rules", !/^Disallow: \S/m.test(robots));

const sitemap = read("sitemap.xml");
ok("sitemap is well-formed", /<urlset[\s\S]*<\/urlset>/.test(sitemap));
ok("sitemap lists homepage", /<loc>[^<]+\/<\/loc>/.test(sitemap));

console.log("\n  links\n");

const site = (profile.canonical || "").replace(/\/$/, "");
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const internal = hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//"));
const missing = internal.filter((h) => {
  const f = h.replace(/^\//, "").split("#")[0] || "index.html";
  return !existsSync(join(DIST, f));
});
ok("internal links resolve to real files", missing.length === 0, missing.join(", "));
warn("no placeholder urls left", !hrefs.some((h) => /TODO|example\.com/i.test(h)),
     hrefs.filter((h) => /TODO|example\.com/i.test(h)).join(", "));
ok("external links use rel=noopener", !/target="_blank"(?![^>]*noopener)/.test(html));

console.log("\n  content\n");

const todos = (read("index.md").match(/TODO/g) || []).length;
warn("no TODO placeholders in content", todos === 0, `${todos} remaining in content.json`);
warn("bio is substantial", (profile.bio || []).join(" ").length > 80, "aim for 1-3 real sentences");
ok("page is small", Buffer.byteLength(html) < 60_000, `${(Buffer.byteLength(html) / 1024).toFixed(1)}kb`);

/* ---------- summary ---------- */

console.log(`\n  ${pass} passed, ${fails.length} failed, ${warns.length} warning(s)\n`);
if (fails.length) {
  console.log("  \x1b[31mfailures:\x1b[0m");
  fails.forEach((f) => console.log(`    - ${f}`));
  console.log();
  process.exit(1);
}
if (warns.length) {
  console.log("  \x1b[33mwarnings (safe to deploy, worth fixing):\x1b[0m");
  warns.forEach((w) => console.log(`    - ${w}`));
  console.log();
}
console.log("  \x1b[32mall structural checks passed\x1b[0m\n");
