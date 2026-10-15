// Progressive enhancement: every article and destination also works without JS.
const nav = document.querySelector("#main-nav");
const menu = document.querySelector(".menu-toggle");
if (nav && menu) {
  nav.classList.add("enhanced");
  menu.hidden = false;
  const closeMenu = () => {
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "Відкрити навігацію");
    nav.classList.remove("is-open");
  };
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute(
      "aria-label",
      open ? "Закрити навігацію" : "Відкрити навігацію",
    );
    nav.classList.toggle("is-open", open);
  });
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      closeMenu();
      menu.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target) && !menu.contains(event.target))
      closeMenu();
  });
  matchMedia("(min-width: 601px)").addEventListener("change", closeMenu);
}

const cards = [...document.querySelectorAll(".tool-card")];
const controls = document.querySelector(".tool-controls");
const search = document.querySelector("#tool-search");
const filters = [...document.querySelectorAll("[data-filter]")];
let activeFilter = "all";
const normalize = (text) =>
  text
    .normalize("NFKC")
    .toLocaleLowerCase("uk")
    .trim()
    .replace(/[’'`ʼ]/g, "");
function filterTools() {
  const query = normalize(search?.value || "");
  let visible = 0;
  for (const card of cards) {
    const matches =
      (activeFilter === "all" || card.dataset.category === activeFilter) &&
      normalize(card.dataset.search).includes(query);
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  filters.forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.filter === activeFilter),
    ),
  );
  const empty = document.querySelector(".empty-state");
  if (empty) empty.hidden = visible !== 0;
  const status = document.querySelector("#filter-status");
  if (status)
    status.textContent = `Показано інструментів: ${visible} із ${cards.length}`;
}
function resetTools() {
  activeFilter = "all";
  if (search) search.value = "";
  filterTools();
}
if (controls && search) {
  controls.hidden = false;
  filters.forEach((button) =>
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      filterTools();
    }),
  );
  search.addEventListener("input", filterTools);
  document.querySelector("#reset-filters")?.addEventListener("click", () => {
    resetTools();
    search.focus();
  });
  filterTools();
}

// Reveal the requested card even when a search or category currently hides it.
function revealTool(id, focus = false) {
  const target = document.getElementById(id);
  if (!target?.classList.contains("tool-card")) return;
  resetTools();
  target.querySelector("details").open = true;
  if (focus) {
    target.querySelector("summary").focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }
}
document
  .querySelectorAll("[data-open-tool]")
  .forEach((link) =>
    link.addEventListener("click", () =>
      revealTool(link.dataset.openTool, true),
    ),
  );
window.addEventListener("hashchange", () => revealTool(location.hash.slice(1)));
revealTool(location.hash.slice(1));

const scenarios = [...document.querySelectorAll("[data-scenario]")];
const scenarioInputs = [...document.querySelectorAll('input[name="scenario"]')];
if (scenarioInputs.length) {
  document.querySelector(".scenario-options").hidden = false;
  document.querySelector(".scenario-results").classList.add("enhanced");
  function selectScenario(value) {
    scenarios.forEach((panel) => {
      panel.hidden = panel.dataset.scenario !== value;
    });
  }
  scenarioInputs.forEach((input) =>
    input.addEventListener("change", () => selectScenario(input.value)),
  );
  selectScenario(scenarioInputs.find((input) => input.checked).value);
}

const tocLinks = [...document.querySelectorAll(".contents-nav a")];
const sections = [...document.querySelectorAll(".reading-section")];
if (sections.length) {
  // Use section positions so very long articles remain active as they are read.
  let scheduled = false;
  function updateContents() {
    const active =
      [...sections]
        .reverse()
        .find((section) => section.getBoundingClientRect().top <= 170) ||
      sections[0];
    tocLinks.forEach((link) => {
      if (link.hash === `#${active.id}`)
        link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    scheduled = false;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(updateContents);
      }
    },
    { passive: true },
  );
  updateContents();
}
