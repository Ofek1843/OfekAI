import { auth } from "./firebase-config.js";
import { getRecentConversations } from "./conversations.js";

const sessionTrail = document.getElementById("sessionTrail");
const newSessionBtn = document.getElementById("newSessionBtn");

async function waitForAuthenticatedUser() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (auth.currentUser) {
      return auth.currentUser;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

function getConversationTitle(conversation) {
  const title = conversation.title?.trim();

  if (title) {
    return title;
  }

  const category = conversation.category?.trim();

  if (category) {
    return category;
  }

  return "Training Session";
}

function getConversationId(conversation) {
  return conversation.id || conversation.conversationId || null;
}

function renderConversations(conversations) {
  sessionTrail.innerHTML = "";

  if (!conversations.length) {
    sessionTrail.innerHTML = `
      <span class="session-trail-empty">
        No saved sessions yet
      </span>
    `;

    return;
  }

  conversations.forEach((conversation) => {
    const conversationId = getConversationId(conversation);

    if (!conversationId) {
      console.warn("Conversation has no ID:", conversation);
      return;
    }

    const button = document.createElement("button");

    button.type = "button";
    button.className = "session-trail-item";
    button.textContent = getConversationTitle(conversation);
    button.dataset.conversationId = conversationId;

    button.addEventListener("click", () => {
      document
        .querySelectorAll(".session-trail-item")
        .forEach((item) => item.classList.remove("active"));

      button.classList.add("active");

      window.dispatchEvent(
        new CustomEvent("conversation-selected", {
          detail: {
            conversationId,
          },
        })
      );
    });

    sessionTrail.appendChild(button);
  });
}

export async function refreshSessionTrail() {
  try {
    const user = await waitForAuthenticatedUser();

    if (!user) {
      sessionTrail.innerHTML = `
        <span class="session-trail-empty">
          User not authenticated
        </span>
      `;

      return;
    }

    const conversations = await getRecentConversations();

    renderConversations(conversations);
  } catch (error) {
    console.error("Failed to load session trail:", error);

    sessionTrail.innerHTML = `
      <span class="session-trail-empty">
        Could not load sessions
      </span>
    `;
  }
}

newSessionBtn?.addEventListener("click", () => {
  window.dispatchEvent(new Event("new-session-requested"));

  document
    .querySelectorAll(".session-trail-item")
    .forEach((item) => item.classList.remove("active"));
});

window.addEventListener("conversation-updated", refreshSessionTrail);

refreshSessionTrail();