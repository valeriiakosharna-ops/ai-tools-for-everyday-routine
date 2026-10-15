// Validate the actual in-memory HTML example, never simulate command output.
export function validateDemoChange(beforeSource, afterSource, expectedTitle) {
  const parser = new DOMParser();
  const before = parser.parseFromString(beforeSource, "text/html");
  const after = parser.parseFromString(afterSource, "text/html");
  const texts = (doc) =>
    [...doc.querySelectorAll("p, button")].map((node) => node.outerHTML);
  const beforeWithoutHeading = before.documentElement.cloneNode(true);
  const afterWithoutHeading = after.documentElement.cloneNode(true);
  beforeWithoutHeading.querySelector("h1")?.replaceChildren();
  afterWithoutHeading.querySelector("h1")?.replaceChildren();
  return [
    {
      label: "Знайдіть рівно один головний заголовок.",
      passed:
        before.querySelectorAll("h1").length === 1 &&
        after.querySelectorAll("h1").length === 1,
    },
    {
      label: "Звірте новий заголовок із вашим запитом.",
      passed: after.querySelector("h1")?.textContent === expectedTitle,
    },
    {
      label: "Переконайтеся, що текст і кнопка не змінилися.",
      passed: JSON.stringify(texts(before)) === JSON.stringify(texts(after)),
    },
    {
      label: "Перевірте, що ви змінили лише вміст заголовка.",
      passed: beforeWithoutHeading.isEqualNode(afterWithoutHeading),
    },
  ];
}

const demo = document.querySelector("[data-agent-simulator]");
if (demo) {
  const panels = [...demo.querySelectorAll("[data-demo-step]")];
  const path = [...demo.querySelectorAll(".agent-demo-path li")];
  const before = demo.querySelector("#agent-demo-before code").textContent;
  const expectedTitle = demo.dataset.demoTitle;
  const beforeDocument = new DOMParser().parseFromString(before, "text/html");
  const originalTitle = beforeDocument.querySelector("h1").textContent;
  const after = before.replace(
    `<h1>${originalTitle}</h1>`,
    `<h1>${expectedTitle}</h1>`,
  );
  const afterCode = demo.querySelector("#agent-demo-after code");
  const preview = demo.querySelector(".agent-preview");
  const frame = preview.querySelector("iframe");
  const previewLabel = demo.querySelector("[data-demo-preview-label]");
  const controls = demo.querySelector(".agent-demo-controls");
  const back = demo.querySelector("[data-demo-back]");
  const next = demo.querySelector("[data-demo-next]");
  const status = demo.querySelector("[data-demo-status]");
  const checks = demo.querySelector("[data-demo-checks]");
  const nextLabels = [
    "Перегляньте різницю →",
    "Застосуйте зміну →",
    "Перевірте приклад →",
  ];
  let step = 0;
  let currentSource = before;

  function showStep(focus = false) {
    currentSource = step >= 2 ? after : before;
    afterCode.textContent = after;
    panels.forEach((panel, index) => {
      panel.hidden = index !== step;
    });
    path.forEach((item, index) => {
      item.dataset.visited = String(index < step);
      if (index === step) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    back.disabled = step === 0;
    next.hidden = step === panels.length - 1;
    next.textContent = nextLabels[step] || "";
    previewLabel.textContent =
      step >= 2
        ? "ПЕРЕГЛЯНЬТЕ ПРИКЛАД ПІСЛЯ ЗМІНИ"
        : "ПЕРЕГЛЯНЬТЕ ПРИКЛАД ДО ЗМІНИ";
    frame.srcdoc = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ваш навчальний приклад</title><style>body{margin:0;padding:24px;font:15px/1.65 Arial,sans-serif;color:#302a40;background:white}h1{font-size:26px;line-height:1.2;letter-spacing:-.03em;margin:0 0 14px}p{margin:0 0 18px}button{font:700 13px Arial,sans-serif;border:0;padding:12px 18px;border-radius:5px;background:#00a6eb;color:#102e42}</style></head><body>${currentSource}</body></html>`;
    status.textContent = `Ви на кроці ${step + 1} із ${panels.length}. ${step < 2 ? "Навчальний файл ще не змінено." : "Ви застосували зміну до навчального прикладу."}`;
    if (step === 3) {
      const results = validateDemoChange(before, currentSource, expectedTitle);
      checks.replaceChildren(
        ...results.map((result) => {
          const item = document.createElement("li");
          item.dataset.passed = String(result.passed);
          const outcome = document.createElement("strong");
          outcome.textContent = result.passed
            ? "✓ Виконано"
            : "! Є розбіжність";
          item.append(outcome, document.createTextNode(result.label));
          return item;
        }),
      );
      const passed = results.filter((result) => result.passed).length;
      status.textContent = `Ви перевірили навчальний приклад у браузері: виконано ${passed} із ${results.length} умов. Реальну збірку проєкту ви тут не запускали.`;
    }
    if (focus) {
      const heading = panels[step].querySelector("h3");
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "nearest" });
    }
  }
  back.addEventListener("click", () => {
    step = Math.max(0, step - 1);
    showStep(true);
  });
  next.addEventListener("click", () => {
    step = Math.min(panels.length - 1, step + 1);
    showStep(true);
  });
  demo.querySelector("[data-demo-reset]").addEventListener("click", () => {
    step = 0;
    showStep(true);
  });
  controls.hidden = false;
  preview.hidden = false;
  showStep();
}
