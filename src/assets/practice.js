// Keep all instructions readable when JavaScript, clipboard, or storage is unavailable.
document.querySelectorAll("[data-copy-target]").forEach((button) => {
  const prompt = document.getElementById(button.dataset.copyTarget);
  if (!prompt) return;
  button.hidden = false;
  button.addEventListener("click", async () => {
    const status = button.closest(".prompt-card").querySelector(".copy-status");
    // Clear the live region so repeating the same action is announced again.
    status.textContent = "";
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(prompt.textContent);
      status.textContent =
        "Ви скопіювали запит. Вставте його в чат обраного інструмента.";
    } catch {
      prompt.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(prompt);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent =
        "Не вдалося скопіювати автоматично. Запит виділено — скопіюйте його вручну.";
    }
  });
});

const progressPanel = document.querySelector(".practice-progress");
const completionInputs = [
  ...document.querySelectorAll("[data-complete-exercise]"),
];
if (progressPanel && completionInputs.length) {
  const key = "nix-ai-practice-v1";
  const progress = document.querySelector("#practice-progress-bar");
  const status = document.querySelector("#practice-progress-status");
  const storageNote = document.querySelector("#practice-storage-note");
  let storageAvailable = true;
  let completed = [];
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(saved))
      completed = saved.filter((id) => typeof id === "string");
  } catch {
    storageAvailable = false;
  }

  function updateProgress() {
    const count = completionInputs.filter((input) => input.checked).length;
    progress.value = count;
    status.textContent =
      count === completionInputs.length
        ? `Ви завершили всі ${count} вправ. Підбийте свої підсумки!`
        : `Ви завершили ${count} із ${completionInputs.length} вправ.`;
    completionInputs.forEach((input) => {
      input.closest("[data-exercise]").dataset.completed = String(
        input.checked,
      );
    });
    storageNote.textContent = storageAvailable
      ? "Ваші позначки зберігаються лише в цьому браузері. Ви самі оцінюєте виконання."
      : "Ваш браузер не зберігає позначки. Користуйтеся ними в цій вкладці; після перезавантаження вони можуть зникнути.";
  }

  function saveProgress() {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(
          completionInputs
            .filter((input) => input.checked)
            .map((input) => input.dataset.completeExercise),
        ),
      );
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
    updateProgress();
  }

  completionInputs.forEach((input) => {
    input.checked = completed.includes(input.dataset.completeExercise);
    input.closest(".exercise-complete").hidden = false;
    input.addEventListener("change", saveProgress);
  });
  progressPanel.hidden = false;
  progressPanel
    .querySelector(".progress-reset")
    .addEventListener("click", () => {
      completionInputs.forEach((input) => {
        input.checked = false;
      });
      saveProgress();
    });
  updateProgress();
}
