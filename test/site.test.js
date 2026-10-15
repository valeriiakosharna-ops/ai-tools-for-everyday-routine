import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("_site");
const prefixSegments = (process.env.SITE_PATH_PREFIX || "/")
  .split("/")
  .filter(Boolean);
const prefix = prefixSegments.length ? `/${prefixSegments.join("/")}/` : "/";
const origin = "https://example.github.io";

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? filesUnder(path.join(directory, entry.name))
          : path.join(directory, entry.name),
      ),
    )
  ).flat();
}

const files = await filesUnder(output);
const pages = files.filter((file) => file.endsWith(".html"));
const htmlByFile = new Map(
  await Promise.all(
    pages.map(async (file) => [file, await readFile(file, "utf8")]),
  ),
);

test("build produces the five intended Ukrainian pages with navigation and branding", () => {
  assert.equal(pages.length, 5);
  for (const file of [
    "index.html",
    "taxonomy/index.html",
    "practice/index.html",
    "simulators/index.html",
    "404.html",
  ]) {
    const html = htmlByFile.get(path.join(output, file));
    assert.ok(html, `${file} was built`);
    assert.match(html, /<html lang="uk">/);
    assert.equal(
      (html.match(/<h1\b/g) || []).length,
      1,
      `${file} has one primary heading`,
    );
    assert.match(html, /id="main-nav"/);
    assert.match(
      html,
      new RegExp(
        `${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}assets/logo\\.svg`,
      ),
    );
    assert.doesNotMatch(html, /\{\{|\{%|static-rsc-4/);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${file} has unique anchors`);
  }
});

test("every local link, fragment, stylesheet, script and image resolves under the Pages prefix", async () => {
  let checked = 0;
  for (const [file, html] of htmlByFile) {
    const relative = path
      .relative(output, file)
      .split(path.sep)
      .join("/")
      .replace(/index\.html$/, "");
    const currentUrl = new URL(`${prefix}${relative}`, origin);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const url = new URL(match[1].replaceAll("&amp;", "&"), currentUrl);
      if (url.origin !== origin) continue;
      assert.ok(
        url.pathname.startsWith(prefix),
        `${match[1]} stays under ${prefix}`,
      );
      let targetPath = path.join(
        output,
        decodeURIComponent(url.pathname.slice(prefix.length)),
      );
      const metadata = await stat(targetPath).catch(() => null);
      assert.ok(metadata, `${file}: missing target ${match[1]}`);
      if (metadata.isDirectory())
        targetPath = path.join(targetPath, "index.html");
      assert.ok(
        (await stat(targetPath)).isFile(),
        `${match[1]} is a real file`,
      );
      if (url.hash) {
        const target = await readFile(targetPath, "utf8");
        assert.ok(
          target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
          `${file}: missing anchor ${match[1]}`,
        );
      }
      checked += 1;
    }
  }
  assert.ok(checked > 80, "navigation and article links were exercised");
});

test("taxonomy includes all six detailed tools, four approaches and official sources in static HTML", async () => {
  const data = JSON.parse(await readFile("src/_data/taxonomy.json", "utf8"));
  const html = htmlByFile.get(path.join(output, "taxonomy/index.html"));
  assert.equal(data.tools.length, 6);
  assert.equal(data.categories.length, 4);
  for (const tool of data.tools) {
    assert.ok(html.includes(`id="${tool.id}"`));
    assert.ok(html.includes(tool.description));
    assert.ok(html.includes(tool.limitation));
    for (const link of tool.links) {
      assert.equal(new URL(link.url).protocol, "https:");
      assert.ok(html.includes(link.url.replaceAll("&", "&amp;")));
    }
  }
  for (const section of [
    "approaches",
    "tools",
    "comparison",
    "results",
    "choose",
  ]) {
    assert.ok(html.includes(`id="${section}"`));
  }
});
