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

test("practice renders five actionable exercises, copyable prompts, sample sources and an optional agent demonstration", async () => {
  const data = JSON.parse(await readFile("src/_data/practice.json", "utf8"));
  const html = htmlByFile.get(path.join(output, "practice/index.html"));
  assert.equal(data.exercises.length, 5);
  assert.equal((html.match(/data-complete-exercise=/g) || []).length, 5);
  const promptIds = new Set();
  for (const exercise of data.exercises) {
    assert.ok(html.includes(`id="${exercise.id}"`));
    assert.ok(html.includes(exercise.title));
    assert.ok(html.includes(exercise.result));
    assert.ok(exercise.steps.length >= 4);
    assert.ok(exercise.checks.length >= 3);
    assert.ok(exercise.reflection.length >= 2);
    for (const prompt of exercise.prompts) {
      assert.ok(!promptIds.has(prompt.id), "prompt IDs are unique");
      promptIds.add(prompt.id);
      assert.ok(html.includes(`id="${prompt.id}"`));
      assert.ok(html.includes(`data-copy-target="${prompt.id}"`));
      assert.ok(html.includes(prompt.text));
    }
  }
  for (const file of ["event-brief.txt", "event-update.txt"]) {
    const content = await readFile(
      path.join(output, "assets/materials", file),
      "utf8",
    );
    assert.match(content, /вигаданий документ/);
    assert.ok(html.includes(`${prefix}assets/materials/${file}`));
  }
  assert.ok(html.includes('id="agent-demo"'));
  assert.ok(html.includes('id="agent-prompt"'));
  assert.ok(html.includes('id="practice-summary"'));
  assert.equal((html.match(/data-demo-step=/g) || []).length, 4);
  assert.ok(html.includes('id="agent-demo-before"'));
  assert.ok(html.includes('id="agent-demo-after"'));
  assert.ok(html.includes("data-demo-checks"));
  assert.ok(html.includes('sandbox=""'));
  assert.match(html, /Навчальна симуляція/);
  assert.doesNotMatch(
    html,
    /долучіться до демонстрації|пропустіть цей додатковий крок/,
  );
});

test("pages address the reader directly and advertise practice as available", () => {
  for (const [file, html] of htmlByFile) {
    assert.doesNotMatch(
      html,
      /студент|користувач|дослідник|волонтер(?!ськ)/iu,
      `${file}: avoid third-person reader roles`,
    );
    const practiceNavigation = html.match(
      /<a href="[^"]*\/practice\/"[^>]*>(.*?)<\/a>/s,
    );
    assert.ok(practiceNavigation, `${file} links to practice`);
    assert.doesNotMatch(practiceNavigation[1], /скоро|Незабаром/);
  }
  const home = htmlByFile.get(path.join(output, "index.html"));
  assert.match(home, /Перейдіть до практики/);
  assert.doesNotMatch(
    htmlByFile.get(path.join(output, "practice/index.html")),
    /Розділ готується/,
  );
});
