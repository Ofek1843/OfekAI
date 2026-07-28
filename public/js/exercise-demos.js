import {
  exerciseImageUrl,
  fallbackExerciseImageUrl,
  slugifyExerciseName
} from "./exercise-image.js";

const MODAL_ID = "exerciseDemoModal";

function ensureModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "exercise-demo-modal hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="exercise-demo-backdrop" data-exercise-demo-close></div>
    <article class="exercise-demo-panel">
      <button class="exercise-demo-close" type="button" aria-label="Close demo" data-exercise-demo-close>×</button>
      <div class="exercise-demo-copy">
        <span class="exercise-demo-kicker">Exercise demo</span>
        <h2 id="exerciseDemoTitle">Demo</h2>
        <p id="exerciseDemoStatus">Verified movement illustration.</p>
      </div>
      <div class="exercise-demo-media">
        <img id="exerciseDemoImage" alt="" loading="lazy">
      </div>
    </article>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-exercise-demo-close]")) closeDemoModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeDemoModal();
    }
  });

  return modal;
}

function closeDemoModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.classList.remove("exercise-demo-open");
}

function openDemoModal(exerciseName) {
  const modal = ensureModal();
  const title = modal.querySelector("#exerciseDemoTitle");
  const status = modal.querySelector("#exerciseDemoStatus");
  const image = modal.querySelector("#exerciseDemoImage");
  const fallbackUrl = fallbackExerciseImageUrl();
  const sourceUrl = exerciseImageUrl(exerciseName);

  title.textContent = exerciseName || "Exercise demo";
  status.textContent = "Verified movement illustration.";
  image.alt = `${exerciseName || "Exercise"} demonstration`;
  image.dataset.expectedExercise = slugifyExerciseName(exerciseName);
  image.src = sourceUrl || fallbackUrl;

  image.onerror = () => {
    image.onerror = null;
    image.src = fallbackUrl;
    status.textContent =
      "No verified demonstration image exists yet. The exercise remains usable.";
  };

  modal.classList.remove("hidden");
  document.body.classList.add("exercise-demo-open");
}

export function setupExerciseDemos(root = document) {
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-exercise-demo]");
    if (!button) return;
    event.preventDefault();
    openDemoModal(
      button.dataset.exerciseDemo ||
        button.dataset.exercise ||
        button.getAttribute("aria-label") ||
        button.textContent ||
        ""
    );
  });
}
