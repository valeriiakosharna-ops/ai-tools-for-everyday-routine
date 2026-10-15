import {
  contextBudget,
  nearestDocuments,
  keywordDocuments,
  ragAnswer,
} from "./ai-lab-models.js";

const dataNode = document.querySelector("#ai-lab-data");
if (dataNode) {
  const data = JSON.parse(dataNode.textContent);
  const byId = (id) => document.getElementById(id);
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  // Load the concrete tokenizer vocabulary only after an explicit action.
  const tokenInput = byId("token-text");
  const tokenButton = byId("tokenize");
  const tokenStatus = byId("token-status");
  let tokenizerPromise;
  let tokenizerAttempt = 0;
  let tokenVersion = 0;
  async function tokenize() {
    const version = ++tokenVersion;
    const text = tokenInput.value;
    tokenButton.disabled = true;
    byId("token-output").hidden = true;
    tokenStatus.textContent =
      "Зачекайте, поки завантажиться словник cl100k_base…";
    try {
      if (!tokenizerPromise) {
        const url = new URL("./tokenizer.js", import.meta.url);
        if (tokenizerAttempt)
          url.searchParams.set("retry", String(tokenizerAttempt));
        tokenizerPromise = import(url.href);
      }
      const { encode, decode } = await tokenizerPromise;
      if (version !== tokenVersion) return;
      const options = { disallowedSpecial: new Set() };
      const ids = encode(text, options);
      byId("token-count").textContent = String(ids.length);
      byId("character-count").textContent = String(Array.from(text).length);
      byId("token-pieces").replaceChildren(
        ...ids.map((id) => {
          const piece = decode([id]);
          const reencoded = piece.includes("\uFFFD")
            ? encode(piece, options)
            : [id];
          const partial = reencoded.length !== 1 || reencoded[0] !== id;
          const visible = partial
            ? "фрагмент байтів"
            : piece
                .replaceAll(" ", "␠")
                .replaceAll("\n", "↵")
                .replaceAll("\t", "⇥");
          const item = make("li");
          item.append(make("code", visible), make("small", `ID ${id}`));
          return item;
        }),
      );
      byId("token-roundtrip").textContent = decode(ids);
      byId("token-output").hidden = false;
      tokenStatus.textContent = ids.length
        ? `Ви отримали ${ids.length} токенів у cl100k_base. Перегляньте фрагменти й числові ID нижче.`
        : "Ви ввели порожній текст: отримали 0 токенів. Додайте текст і спробуйте знову.";
    } catch {
      tokenizerPromise = undefined;
      tokenizerAttempt += 1;
      if (version === tokenVersion)
        tokenStatus.textContent =
          "Не вдалося завантажити токенізатор. Натисніть кнопку ще раз або скористайтеся офіційним токенізатором у джерелах нижче.";
    } finally {
      if (version === tokenVersion) tokenButton.disabled = false;
    }
  }
  tokenButton.addEventListener("click", tokenize);
  tokenInput.addEventListener("input", () => {
    tokenVersion += 1;
    tokenButton.disabled = false;
    byId("token-output").hidden = true;
    tokenStatus.textContent =
      "Ви змінили текст. Натисніть «Розбийте на токени», щоб перерахувати результат.";
  });
  document.querySelectorAll("[data-token-example]").forEach((button) =>
    button.addEventListener("click", () => {
      tokenInput.value = button.dataset.tokenExample;
      tokenize();
    }),
  );
  document.querySelector("[data-token-controls]").hidden = false;

  function updateContext() {
    const documentUnits = Number(byId("context-document").value);
    const answerUnits = Number(byId("context-answer").value);
    const budget = contextBudget(
      documentUnits,
      answerUnits,
      byId("context-summary").checked,
    );
    byId("context-document-value").textContent = String(documentUnits);
    byId("context-answer-value").textContent = String(answerUnits);
    byId("context-history-value").textContent = String(budget.historyUnits);
    byId("context-document-legend").textContent = String(documentUnits);
    byId("context-answer-legend").textContent = String(answerUnits);
    const units = [
      "instruction",
      ...Array(budget.historyUnits).fill("history"),
      "query",
      ...Array(documentUnits).fill("document"),
      ...Array(answerUnits).fill("answer"),
    ];
    byId("context-desk").replaceChildren(
      ...Array.from({ length: 10 }, (_, index) => {
        const cell = make(
          "span",
          String(index + 1),
          `context-unit unit-${units[index] || "free"}`,
        );
        cell.setAttribute("aria-hidden", "true");
        return cell;
      }),
    );
    const status = byId("context-status");
    status.dataset.overflow = String(budget.overflow > 0);
    status.textContent = budget.overflow
      ? `Вам потрібно ${budget.total} із 10 одиниць: ви перевищили ліміт на ${budget.overflow}. Скоротіть вхідні дані, резерв відповіді або розділіть задачу.`
      : `Ви використали ${budget.total} із 10 одиниць. Вільних: ${budget.remaining}. Для відповіді ви залишили ${answerUnits}.`;
  }
  for (const id of ["context-document", "context-answer", "context-summary"])
    byId(id).addEventListener("input", updateContext);
  byId("context-reset").addEventListener("click", () => {
    byId("context-document").value = "2";
    byId("context-answer").value = "4";
    byId("context-summary").checked = false;
    updateContext();
  });
  document.querySelector("[data-context-controls]").hidden = false;
  updateContext();

  const svg = byId("vector-map");
  const svgElement = (tag, attributes) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes))
      node.setAttribute(key, String(value));
    return node;
  };
  const point = (item) => ({ x: 140 + item.x * 3, y: 20 + item.y * 3 });
  function updateVectors() {
    const query = data.queries.find(
      (query) => query.id === byId("vector-query").value,
    );
    const count = Number(byId("vector-count").value);
    const nearest = nearestDocuments(data.documents, query, count);
    const exact = keywordDocuments(data.documents, query.text);
    byId("vector-count-value").textContent = String(count);
    byId("keyword-results").replaceChildren(
      ...(exact.length
        ? exact.map((doc) => make("li", doc.title))
        : [make("li", "Ви не знайшли точних слів запиту в назвах.")]),
    );
    byId("vector-results").replaceChildren(
      ...nearest.map((doc) => {
        const item = make("li");
        item.append(
          make(
            "strong",
            `${data.documents.findIndex((original) => original.id === doc.id) + 1}. ${doc.title}`,
          ),
          make(
            "small",
            `Умовна відстань: ${doc.distance.toLocaleString("uk", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          ),
        );
        return item;
      }),
    );
    svg.querySelector("[data-map-layer]")?.remove();
    const layer = svgElement("g", {
      "data-map-layer": "",
      "aria-hidden": "true",
    });
    for (let offset = 0; offset <= 100; offset += 20) {
      layer.append(
        svgElement("line", {
          x1: 140 + offset * 3,
          y1: 20,
          x2: 140 + offset * 3,
          y2: 320,
          class: "map-grid",
        }),
        svgElement("line", {
          x1: 140,
          y1: 20 + offset * 3,
          x2: 440,
          y2: 20 + offset * 3,
          class: "map-grid",
        }),
      );
    }
    const current = point(query);
    for (const doc of nearest) {
      const position = point(doc);
      layer.append(
        svgElement("line", {
          x1: current.x,
          y1: current.y,
          x2: position.x,
          y2: position.y,
          class: "map-neighbor",
        }),
      );
    }
    data.documents.forEach((doc, index) => {
      const position = point(doc);
      layer.append(
        svgElement("circle", {
          cx: position.x,
          cy: position.y,
          r: 7,
          class: nearest.some((item) => item.id === doc.id)
            ? "map-point selected"
            : "map-point",
        }),
      );
      const text = svgElement("text", {
        x: position.x + 12,
        y: position.y + 5,
        class: "map-number",
      });
      text.textContent = String(index + 1);
      layer.append(text);
    });
    layer.append(
      svgElement("path", {
        d: `M${current.x},${current.y - 9}l9,9 -9,9 -9,-9Z`,
        class: "map-query",
      }),
    );
    const queryLabel = svgElement("text", {
      x: current.x - 12,
      y: current.y - 18,
      class: "map-query-label",
    });
    queryLabel.textContent = "Ваш запит";
    layer.append(queryLabel);
    svg.append(layer);
    byId("vector-status").textContent =
      `Ви знайшли ${nearest.length} найближчих точок на умовній карті та ${exact.length} назв із точними словами. Зіставте результат зі змістом фрагментів.`;
  }
  byId("vector-query").addEventListener("change", updateVectors);
  byId("vector-count").addEventListener("input", updateVectors);
  document.querySelector("[data-vector-controls]").hidden = false;
  updateVectors();

  const sourceInputs = [...document.querySelectorAll("[data-rag-source]")];
  let searched = false;
  const selectedSources = () =>
    sourceInputs.filter((input) => input.checked).map((input) => input.value);
  function updateRagContext() {
    const ids = selectedSources();
    byId("rag-context").textContent = ids.length
      ? data.ragSources
          .filter((source) => ids.includes(source.id))
          .map((source) => `[${source.id}] ${source.title}\n${source.text}`)
          .join("\n\n")
      : "Ви не передаєте жодного фрагмента.";
    byId("rag-answer").hidden = true;
    byId("rag-status").textContent = searched
      ? "Ви оновили контекст. Складіть відповідь заново, щоб врахувати саме цю добірку."
      : "";
  }
  function clearRag() {
    searched = false;
    sourceInputs.forEach((input) => {
      input.checked = false;
    });
    updateRagContext();
    byId("rag-selection").hidden = true;
    byId("rag-context-wrap").hidden = true;
    byId("rag-generate").disabled = true;
    byId("rag-search-status").textContent =
      "Ви обрали запит. Знайдіть фрагменти, перш ніж складати відповідь.";
  }
  byId("rag-question").addEventListener("change", clearRag);
  byId("rag-search").addEventListener("click", () => {
    const question = data.ragQuestions.find(
      (question) => question.id === byId("rag-question").value,
    );
    searched = true;
    sourceInputs.forEach((input) => {
      input.checked = question.sourceIds.includes(input.value);
    });
    updateRagContext();
    byId("rag-selection").hidden = false;
    byId("rag-context-wrap").hidden = false;
    byId("rag-generate").disabled = false;
    byId("rag-search-status").textContent = question.sourceIds.length
      ? `За заданим навчальним сценарієм ви отримали ${question.sourceIds.length} фрагментів. Змініть добірку вручну, щоб дослідити помилки пошуку.`
      : "За заданим сценарієм ви не отримали потрібних фрагментів. Можете перевірити нестачу даних або додати джерела вручну.";
    byId("rag-status").textContent =
      "Перегляньте переданий контекст і складіть навчальну відповідь.";
  });
  sourceInputs.forEach((input) =>
    input.addEventListener("change", updateRagContext),
  );
  byId("rag-generate").addEventListener("click", () => {
    if (!searched) return;
    const result = ragAnswer(byId("rag-question").value, selectedSources());
    byId("rag-answer-text").replaceChildren(
      ...result.paragraphs.map((text) => make("p", text)),
    );
    byId("rag-warning").textContent = result.warning;
    byId("rag-citations").replaceChildren(
      ...result.citations.map((id) => {
        const link = make("a", `Звірте джерело ${id} ↓`);
        link.href = `#rag-source-${id}`;
        return link;
      }),
    );
    byId("rag-answer").hidden = false;
    byId("rag-status").textContent =
      `Ви склали навчальну відповідь за шаблоном. Використаних джерел: ${result.citations.length}. Звірте текст із першоджерелами.`;
  });
  byId("rag-reset").addEventListener("click", () => {
    byId("rag-question").value = data.ragQuestions[0].id;
    clearRag();
  });
  document.querySelector("[data-rag-controls]").hidden = false;
}
