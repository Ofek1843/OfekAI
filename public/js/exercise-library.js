const search = document.getElementById("exercise-search");
const cards = [...document.querySelectorAll("[data-exercise-card]")];
const sections = [...document.querySelectorAll("[data-muscle-section]")];
const count = document.getElementById("exercise-count");

search?.addEventListener("input", () => {
  const query = search.value.trim().toLowerCase();
  let visible = 0;

  for (const card of cards) {
    const matches = !query || card.dataset.search.includes(query);
    card.hidden = !matches;
    if (matches) visible += 1;
  }

  for (const section of sections) {
    section.hidden = !section.querySelector("[data-exercise-card]:not([hidden])");
  }

  if (count) count.textContent = `Showing ${visible} of ${cards.length} movements`;
});
