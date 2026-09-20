const helpSearch = document.querySelector("#helpSearch");
const helpCards = Array.from(document.querySelectorAll("[data-help-card]"));

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
filterHelpCards();
