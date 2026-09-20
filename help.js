const helpSearch = document.querySelector("#helpSearch");
const helpCards = Array.from(document.querySelectorAll("[data-help-card]"));
const themeToggle = document.querySelector("#themeToggle");

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  const isDark = normalizedTheme === "dark";
  document.documentElement.dataset.theme = normalizedTheme;
  themeToggle?.setAttribute("aria-label", isDark ? "Açık modu aç" : "Koyu modu aç");
  themeToggle?.setAttribute("title", isDark ? "Açık modu aç" : "Koyu modu aç");
  localStorage.setItem("listfix-theme", normalizedTheme);
}

function initTheme() {
  const savedTheme = localStorage.getItem("listfix-theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

themeToggle?.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

function filterHelpCards() {
  const query = helpSearch?.value.trim().toLocaleLowerCase("tr-TR") || "";
  let visibleCount = 0;

  helpCards.forEach((card) => {
    const matches = !query || card.textContent.toLocaleLowerCase("tr-TR").includes(query);
    card.classList.toggle("hidden", !matches);
    if (matches) {
      visibleCount += 1;
    }
  });

  document.documentElement.dataset.helpEmpty = visibleCount ? "false" : "true";
}

helpSearch?.addEventListener("input", filterHelpCards);
initTheme();
filterHelpCards();
