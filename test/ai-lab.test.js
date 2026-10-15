import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { encode, decode } from "../_site/assets/tokenizer.js";
import {
  contextBudget,
  nearestDocuments,
  keywordDocuments,
  ragAnswer,
} from "../src/assets/ai-lab-models.js";

const data = JSON.parse(await readFile("src/_data/aiLab.json", "utf8"));

test("shipped cl100k_base tokenizer matches known IDs and round-trips Ukrainian, emoji and literal special-token text", () => {
  assert.deepEqual(encode("Hello, world!"), [9906, 11, 1917, 0]);
  for (const text of [
    "",
    "Кіт спить.",
    "Я вивчаю штучний інтелект.",
    "  Привіт 👩🏽‍💻!\nТест\t✨",
    "<|endoftext|>",
  ]) {
    const ids = encode(text, { disallowedSpecial: new Set() });
    assert.ok(ids.every((id) => Number.isInteger(id) && id >= 0));
    assert.equal(decode(ids), text);
  }
});

test("context budget reserves output and reports overflow without silently dropping input", () => {
  assert.deepEqual(contextBudget(2, 4), {
    capacity: 10,
    historyUnits: 2,
    inputUnits: 6,
    answerUnits: 4,
    total: 10,
    overflow: 0,
    remaining: 0,
  });
  assert.equal(contextBudget(5, 4).overflow, 3);
  assert.equal(
    contextBudget(5, 4, true).overflow,
    2,
    "summarizing history alone is not enough for this document",
  );
  assert.equal(contextBudget(2, 4, true).remaining, 1);
  assert.equal(contextBudget(0, 1).remaining, 5);
});

test("toy vector retrieval ranks actual distances and differs from exact title-word matches", () => {
  const query = (id) => data.queries.find((query) => query.id === id);
  assert.equal(
    nearestDocuments(data.documents, query("wellbeing"), 1)[0].id,
    "rest",
  );
  assert.equal(
    nearestDocuments(data.documents, query("deadline"), 1)[0].id,
    "extension",
  );
  assert.equal(
    nearestDocuments(data.documents, query("car"), 1)[0].id,
    "starter",
  );
  const ranked = nearestDocuments(data.documents, query("wellbeing"), 3);
  assert.equal(ranked.length, 3);
  assert.ok(
    ranked.every(
      (doc, index) => !index || ranked[index - 1].distance <= doc.distance,
    ),
  );
  assert.equal(
    keywordDocuments(data.documents, query("wellbeing").text).length,
    0,
  );
  assert.deepEqual(
    keywordDocuments(data.documents, "стартер").map((doc) => doc.id),
    ["starter"],
  );
});

test("RAG templates use selected sources, expose a missing exception and abstain when data is absent", () => {
  const current = ragAnswer("deadline", ["R1"]);
  assert.deepEqual(current.citations, ["R1"]);
  assert.match(current.paragraphs.join(" "), /20 листопада/);
  const complete = ragAnswer("extension", ["R1", "R2"]);
  assert.deepEqual(complete.citations, ["R1", "R2"]);
  assert.match(complete.paragraphs.join(" "), /погодження/);
  assert.match(complete.paragraphs.join(" "), /23 листопада/);
  const incomplete = ragAnswer("extension", ["R1"]);
  assert.doesNotMatch(incomplete.paragraphs.join(" "), /23 листопада/);
  assert.match(incomplete.warning, /пропустили джерело з винятком/);
  assert.match(
    ragAnswer("extension", ["R2"]).paragraphs.join(" "),
    /не передали джерела з основним терміном/,
  );
  const archived = ragAnswer("deadline", ["R0"]);
  assert.match(archived.paragraphs.join(" "), /18 листопада/);
  assert.match(archived.warning, /застаріле джерело/);
  assert.match(
    ragAnswer("deadline", ["R0", "R1"]).paragraphs.join(" "),
    /20 листопада/,
  );
  assert.deepEqual(ragAnswer("deadline", []).citations, []);
  const absent = ragAnswer("fee", ["R1", "R2", "R0"]);
  assert.deepEqual(absent.citations, []);
  assert.match(absent.paragraphs.join(" "), /не знайдете розміру внеску/);
});
