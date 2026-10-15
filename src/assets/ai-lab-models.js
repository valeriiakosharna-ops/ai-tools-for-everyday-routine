// These three teaching models use explicit rules and hand-assigned coordinates.
// They never call a language model or claim to compute real embeddings.
export function contextBudget(documentUnits, answerUnits, summarize = false) {
  const historyUnits = summarize ? 1 : 2;
  const inputUnits = 1 + historyUnits + 1 + documentUnits;
  return {
    capacity: 10,
    historyUnits,
    inputUnits,
    answerUnits,
    total: inputUnits + answerUnits,
    overflow: Math.max(0, inputUnits + answerUnits - 10),
    remaining: Math.max(0, 10 - inputUnits - answerUnits),
  };
}

export function nearestDocuments(documents, query, count = 3) {
  return documents
    .map((doc) => ({
      ...doc,
      distance: Math.hypot(doc.x - query.x, doc.y - query.y) / 100,
    }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, count);
}

const words = (text) =>
  (
    text
      .toLocaleLowerCase("uk")
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]+/gu) || []
  ).filter((word) => word.length >= 4);
export function keywordDocuments(documents, query) {
  const terms = new Set(words(query));
  return documents.filter((doc) =>
    words(doc.title).some((word) => terms.has(word)),
  );
}

export function ragAnswer(questionId, selectedIds) {
  const selected = new Set(selectedIds);
  const citations = [];
  const paragraphs = [];
  if (questionId === "fee")
    return {
      paragraphs: [
        "У переданих джерелах ви не знайдете розміру внеску. Не визначайте суму за здогадкою — знайдіть додатковий документ.",
      ],
      citations,
      warning: "Ви не маєте достатніх даних для відповіді.",
    };
  if (selected.has("R1")) {
    paragraphs.push("Подайте роботу до 18:00 20 листопада 2026 року.");
    citations.push("R1");
  } else if (selected.has("R0")) {
    paragraphs.push(
      "За обраними архівними умовами ви маєте подати роботу до 18:00 18 листопада 2026 року.",
    );
    citations.push("R0");
  }
  if (questionId === "extension") {
    if (selected.has("R2")) {
      if (!selected.has("R1") && !selected.has("R0"))
        paragraphs.push(
          "Ви не передали джерела з основним терміном подання. Знайдіть його, щоб перевірити, коли потрібно запросити погодження.",
        );
      paragraphs.push(
        "Запросіть погодження до основного терміну. Після погодження подайте роботу до 18:00 23 листопада 2026 року. Не розраховуйте на автоматичне продовження.",
      );
      citations.push("R2");
    } else {
      paragraphs.push(
        "У переданих фрагментах ви не знайдете умов продовження. Знайдіть додаткове джерело, перш ніж вирішувати, чи можете подати роботу пізніше.",
      );
    }
  }
  if (!paragraphs.length)
    paragraphs.push(
      "Ви не передали джерела з відповіддю. Знайдіть потрібні фрагменти, перш ніж робити висновок.",
    );
  const warning = selected.has("R0")
    ? "Ви включили застаріле джерело. Навіть із посиланням ви можете отримати нечинне правило; звірте версії."
    : questionId === "extension" && !selected.has("R2")
      ? "Ви пропустили джерело з винятком. Не прирівнюйте основний термін до повної відповіді про продовження."
      : citations.length
        ? "Відкрийте джерела нижче й перевірте кожен висновок."
        : "Ви не маєте достатніх даних для відповіді.";
  return { paragraphs, citations, warning };
}
