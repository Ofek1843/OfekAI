import { auth } from "./firebase-config.js";
import {
  deleteAllConversations,
  deleteConversation,
  getRecentConversations,
  updateConversationTitle
} from "./conversations.js";

const sessionTrail = document.getElementById("sessionTrail");
const newSessionBtn = document.getElementById("newSessionBtn");
const deleteAllSessionsBtn = document.getElementById("deleteAllSessionsBtn");
const isHebrew = (localStorage.getItem("ofek-ai-language") || "en") === "he";
const labels = isHebrew
  ? { empty: "אין שיחות שמורות", rename: "שינוי שם", remove: "מחיקה", deleteAll: "מחיקת כל השיחות", renamePrompt: "הזן שם חדש לשיחה:", deleteConfirm: "למחוק את השיחה הזאת?", deleteAllConfirm: "למחוק את כל היסטוריית השיחות? לא ניתן לבטל פעולה זו.", loadError: "לא ניתן לטעון את השיחות" }
  : { empty: "No saved sessions yet", rename: "Rename", remove: "Delete", deleteAll: "Delete All", renamePrompt: "Enter a new conversation name:", deleteConfirm: "Delete this conversation?", deleteAllConfirm: "Delete all conversation history? This cannot be undone.", loadError: "Could not load sessions" };

if (deleteAllSessionsBtn) deleteAllSessionsBtn.textContent = labels.deleteAll;

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
        ${labels.empty}
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

    const row = document.createElement("div");
    row.className = "session-trail-row";
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

    const actions = document.createElement("div");
    actions.className = "session-trail-actions";
    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "session-rename-button";
    renameButton.title = labels.rename;
    renameButton.textContent = "✏️";
    renameButton.addEventListener("click", async () => {
      const nextTitle = window.prompt(labels.renamePrompt, getConversationTitle(conversation));
      if (nextTitle === null || !nextTitle.trim()) return;
      await updateConversationTitle({ conversationId, title: nextTitle });
      await refreshSessionTrail();
    });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "session-delete-button";
    deleteButton.title = labels.remove;
    deleteButton.textContent = "🗑️";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm(labels.deleteConfirm)) return;
      await deleteConversation(conversationId);
      window.dispatchEvent(new CustomEvent("conversation-deleted", { detail: { conversationId } }));
      await refreshSessionTrail();
    });
    actions.append(renameButton, deleteButton);
    row.append(button, actions);
    sessionTrail.appendChild(row);
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
        ${labels.loadError}
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

deleteAllSessionsBtn?.addEventListener("click", async () => {
  if (!window.confirm(labels.deleteAllConfirm)) return;
  deleteAllSessionsBtn.disabled = true;
  try {
    await deleteAllConversations();
    window.dispatchEvent(new Event("all-conversations-deleted"));
    await refreshSessionTrail();
  } finally {
    deleteAllSessionsBtn.disabled = false;
  }
});

window.addEventListener("conversation-updated", refreshSessionTrail);

refreshSessionTrail();
