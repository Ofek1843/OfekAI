import { auth, db } from "./firebase-config.js";
import { guardProtectedPage } from "./verification-gate.js";
import { trackPageView } from "./analytics.js";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  escapeHtml,
  formatMessageTime,
  graphPolyline,
  initials,
  mergeMessages,
  safeClientId,
  socialStrings,
  timestampMs
} from "./social-core.mjs";

const $ = (selector) => document.querySelector(selector);
let language = "en";
let ui = socialStrings(language);
const state = {
  user: null,
  profile: null,
  relationships: { friends: [], received: [], sent: [], blocked: [] },
  conversations: [],
  activeConversation: null,
  messages: [],
  nextCursor: null,
  unsubscribe: null,
  subscriptions: [],
  typingAbort: null,
  typingActive: false,
  typingStopTimer: null,
  typingReader: null,
  shareType: null,
  shareSources: [],
  activeArtifact: null,
  unsubscribeArtifact: null,
  copiedArtifacts: new Map(),
  failedMessages: new Map()
};

document.documentElement.lang = language;
document.documentElement.dir = language === "he" ? "rtl" : "ltr";
trackPageView({ page: "social" });

function applyTranslations() {
  const labels = {
    friendsTab: "friends", dashboardLink: "dashboard", identityEyebrow: "identityEyebrow",
    identityTitle: "identityTitle", identityText: "identityText", usernameLabel: "username", usernameHint: "usernameHint", profilePreviewTitle: "profile", profilePreviewEyebrow: "socialProfile",
    discoverableLabel: "discoverable", saveUsernameButton: "createProfile", inboxEyebrow: "private", inboxTitle: "messages",
    friendsEyebrow: "circle", friendsTitle: "friends", friendsIntro: "friendsIntro", searchButton: "search",
    searchResultsTitle: "searchResults", receivedTitle: "received", sentTitle: "sent", friendListTitle: "yourFriends",
    blockedTitle: "blocked", friendsEmptyTitle: "emptyFriendsTitle", friendsEmptyText: "emptyFriendsText",
    conversationEmptyText: "acceptedFriendsHere", chatEmptyTitle: "chooseConversation", chatEmptyText: "chatEmptyText",
    chatFindFriendsButton: "findFriends", messageLabel: "message", loadOlderButton: "loadOlder", shareDialogEyebrow: "shareSafely",
    shareDialogTitle: "shareWithFriend", shareDialogText: "shareText", shareConversationLabel: "conversation",
    shareSourceLabel: "chooseItem", privacyLegend: "weightPrivacy", privacyTotal: "privacyTotal", privacyPercent: "privacyPercent",
    privacyTrend: "privacyTrend", privacyExact: "privacyExact", confirmShareButton: "shareWithFriend"
  };
  for (const [id, key] of Object.entries(labels)) if ($(`#${id}`)) $(`#${id}`).textContent = ui[key];
  const messagesTab = $("#messagesTab");
  const unreadBadge = $("#unreadBadge");
  if (messagesTab && unreadBadge && messagesTab.firstChild?.nodeType === 3) {
    messagesTab.firstChild.nodeValue = `${ui.messages} `;
  }
  $("#userSearchInput").placeholder = ui.searchPlaceholder;
  $("#messageInput").placeholder = ui.messagePlaceholder;
}

async function loadSavedLanguage() {
  const snapshot = await getDoc(doc(db, "users", state.user.uid, "settings", "main"));
  const saved = snapshot.data()?.language;
  language = saved === "he" || saved === "en" ? saved : "en";
  localStorage.setItem("ofek-ai-language", language);
  ui = socialStrings(language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === "he" ? "rtl" : "ltr";
  applyTranslations();
}

function toast(message, isError = false) {
  const element = document.createElement("div");
  element.className = `toast${isError ? " is-error" : ""}`;
  element.textContent = message;
  $("#toastRegion").append(element);
  window.setTimeout(() => element.remove(), 4200);
}

async function api(path, options = {}) {
  const token = await state.user.getIdToken();
  const response = await fetch(`/api/social${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || ui.actionFailed);
    error.code = data.code || "request_failed";
    error.status = response.status;
    throw error;
  }
  return data;
}

function avatar(profile = {}, large = false) {
  const fallback = escapeHtml(profile.initials || initials(profile));
  const photo = typeof profile.photoURL === "string" && /^https:\/\//i.test(profile.photoURL)
    ? `<img src="${escapeHtml(profile.photoURL)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">`
    : "";
  const body = `${photo}<span${photo ? " hidden" : ""}>${fallback}</span>`;
  const label = escapeHtml(profile.displayName || profile.username || "Open profile");
  return `<${profile.interactive ? "button" : "span"} class="avatar${large ? " avatar-large" : ""}${profile.interactive ? " avatar-button" : ""}"${profile.interactive ? ` type="button" data-profile-uid="${escapeHtml(profile.uid)}" aria-label="Open ${label} profile"` : " aria-hidden=\"true\""}>${body}</${profile.interactive ? "button" : "span"}>`;
}

function profileName(profile = {}) {
  return escapeHtml(profile.displayName || profile.username || "FuelPhysique member");
}

function username(profile = {}) {
  return profile.username ? `@${escapeHtml(profile.username)}` : "";
}

function personCard(profile, actions = []) {
  const cardProfile = { ...profile, interactive: true };
  return `<article class="person-card" data-uid="${escapeHtml(profile.uid)}">
    ${avatar(cardProfile)}
    <div class="person-main"><button class="profile-link" type="button" data-profile-uid="${escapeHtml(profile.uid)}"><strong>${profileName(profile)}</strong><span>${username(profile)}</span></button>${badgeMarkup(profile)}</div>
    <div class="person-actions">${actions.map((action) => `<button type="button" data-action="${escapeHtml(action.action)}" data-uid="${escapeHtml(profile.uid)}"${action.id ? ` data-request-id="${escapeHtml(action.id)}"` : ""}>${escapeHtml(action.label)}</button>`).join("")}</div>
  </article>`;
}

function badgeMarkup(profile = {}) {
  const labels = { athlete: ui.athleteBadge, pro: ui.proBadge, coach: ui.coachBadge, developer: ui.developerBadge };
  return `<div class="profile-badges" aria-label="Badges">${(profile.badges || ["athlete"]).map((badge) => `<span class="profile-badge" data-badge="${escapeHtml(badge)}">${escapeHtml(labels[badge] || badge)}</span>`).join("")}</div>`;
}

function renderIdentityCard() {
  if (!state.profile) return;
  $("#myIdentityCard").innerHTML = `${avatar({ ...state.profile, interactive: true })}<div><button class="profile-link" type="button" data-profile-uid="${escapeHtml(state.profile.uid)}"><strong>${profileName(state.profile)}</strong><span>@${escapeHtml(state.profile.username)}</span></button>${badgeMarkup(state.profile)}<a class="profile-edit-link" href="/app.html?settings=open&section=profile">${escapeHtml(ui.editProfile)}</a></div>`;
}

function renderRelationships() {
  const { friends, received, sent, blocked } = state.relationships;
  $("#friendCount").textContent = friends.length;
  $("#receivedCount").textContent = received.length;
  $("#sentCount").textContent = sent.length;
  $("#friendsEmpty").hidden = friends.length > 0;
  $("#friendList").innerHTML = friends.map((item) => personCard(item.profile, [
    { action: "message", label: ui.messageAction },
    { action: "remove", label: ui.remove },
    { action: "block", label: ui.block }
  ])).join("");
  $("#receivedRequests").innerHTML = received.length ? received.map((item) => personCard(item.profile, [
    { action: "accept", label: ui.accept, id: item.id },
    { action: "decline", label: ui.decline, id: item.id },
    { action: "block", label: ui.block }
  ])).join("") : `<p class="section-status">${ui.noRequests}</p>`;
  $("#sentRequests").innerHTML = sent.length ? sent.map((item) => personCard(item.profile, [
    { action: "cancel", label: ui.cancel, id: item.id }
  ])).join("") : `<p class="section-status">${ui.noRequests}</p>`;
  $("#blockedList").innerHTML = blocked.length ? blocked.map((item) => personCard(item.profile, [
    { action: "unblock", label: ui.unblock }
  ])).join("") : `<p class="section-status">${ui.noRequests}</p>`;
}

function unreadTotal() {
  return state.conversations.reduce((sum, conversation) => sum + Number(conversation.unreadCount || 0), 0);
}

function renderConversations() {
  $("#conversationSkeletons").hidden = true;
  $("#conversationEmpty").hidden = state.conversations.length > 0;
  $("#conversationList").innerHTML = state.conversations.map((conversation) => {
    const active = state.activeConversation?.id === conversation.id;
    return `<button class="conversation-card${active ? " is-active" : ""}" type="button" data-conversation-id="${escapeHtml(conversation.id)}">
      ${avatar(conversation.profile)}
      <span class="conversation-copy"><strong>${profileName(conversation.profile)}</strong><span>${escapeHtml(conversation.lastMessagePreview || username(conversation.profile) || ui.messages)}</span></span>
      <span class="conversation-meta"><time>${formatMessageTime(conversation.lastMessageAt, language)}</time>${Number(conversation.unreadCount || 0) ? `<b>${Math.min(99, Number(conversation.unreadCount))}</b>` : ""}</span>
    </button>`;
  }).join("");
  const unread = unreadTotal();
  $("#unreadBadge").hidden = unread === 0;
  $("#unreadBadge").textContent = String(Math.min(99, unread));
}

async function loadRelationships() {
  state.relationships = await api("/relationships");
  renderRelationships();
}

async function loadConversations() {
  const data = await api("/conversations");
  state.conversations = data.conversations || [];
  if (state.activeConversation && !state.conversations.some((item) => item.id === state.activeConversation.id)) {
    stopTypingChannel();
    state.unsubscribe?.();
    state.unsubscribe = null;
    state.activeConversation = null;
    $("#chatPanel").hidden = true;
    $("#chatEmpty").hidden = false;
  }
  renderConversations();
}

function stopRealtimeSubscriptions() {
  for (const unsubscribe of state.subscriptions.splice(0)) unsubscribe?.();
}

function startRealtimeSubscriptions() {
  stopRealtimeSubscriptions();
  const uid = state.user.uid;
  let relationshipRefresh = null;
  const refreshRelationships = () => {
    if (relationshipRefresh) return;
    relationshipRefresh = setTimeout(async () => {
      relationshipRefresh = null;
      try { await loadRelationships(); } catch (error) { toast(error.message, true); }
    }, 60);
  };
  const relationshipQueries = [
    query(collection(db, "friendRequests"), where("toUid", "==", uid), where("status", "==", "pending"), limit(50)),
    query(collection(db, "friendRequests"), where("fromUid", "==", uid), where("status", "==", "pending"), limit(50)),
    query(collection(db, "friendships"), where("participants", "array-contains", uid), limit(100)),
    query(collection(db, "users", uid, "blocks"), limit(100))
  ];
  for (const relationshipQuery of relationshipQueries) {
    state.subscriptions.push(onSnapshot(relationshipQuery, refreshRelationships, (error) => {
      console.warn("Social relationship listener unavailable", error?.code);
      toast(error?.code === "failed-precondition" ? ui.liveChatIndex : ui.liveChatUnavailable, true);
    }));
  }
  const summaryQuery = query(collection(db, "users", uid, "conversationSummaries"), orderBy("updatedAt", "desc"), limit(50));
  state.subscriptions.push(onSnapshot(summaryQuery, async () => {
    try { await loadConversations(); } catch (error) { toast(error.message, true); }
  }, (error) => toast(error?.code === "failed-precondition" ? ui.liveChatIndex : ui.liveChatUnavailable, true)));
}

function setView(view) {
  const messages = view === "messages";
  $("#friendsView").hidden = messages;
  $("#messagesView").hidden = !messages;
  $("#friendsTab").classList.toggle("is-active", !messages);
  $("#messagesTab").classList.toggle("is-active", messages);
  $("#socialApp").classList.remove("show-conversations");
}

function artifactCard(message) {
  const typeLabel = ui[message.artifactType] || message.artifactType;
  const copyable = ["workout", "nutrition"].includes(message.artifactType);
  const copied = state.copiedArtifacts.has(message.artifactId);
  return `<article class="artifact-card" data-artifact-id="${escapeHtml(message.artifactId)}">
    <div class="artifact-visual"><span>${escapeHtml(typeLabel).toUpperCase()}</span></div>
    <div class="artifact-body"><h3>${escapeHtml(message.artifactTitle || typeLabel)}</h3><p>${ui.shared} · ${formatMessageTime(message.createdAt, language)}</p></div>
    <div class="artifact-actions"><button type="button" data-action="preview-artifact" data-artifact-id="${escapeHtml(message.artifactId)}">${ui.preview}</button>${copyable ? `<button class="copy-action" type="button" data-action="copy-artifact" data-artifact-id="${escapeHtml(message.artifactId)}">${copied ? ui.copied : message.artifactType === "nutrition" ? ui.copyNutrition : ui.copyWorkout}</button>` : ""}</div>
  </article>`;
}

function renderMessages({ preserveScroll = false } = {}) {
  const scroller = $("#messageScroller");
  const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140;
  const previousHeight = scroller.scrollHeight;
  $("#messageList").innerHTML = state.messages.map((message) => {
    const sent = message.senderUid === state.user.uid;
    const failed = message.status === "failed";
    const content = message.type === "artifact" ? artifactCard(message) : `<div class="message-bubble" dir="auto">${message.deletedAt ? `<em>${ui.deleted}</em>` : escapeHtml(message.text || "")}</div>`;
    return `<li class="message-row${sent ? " is-sent" : ""}" data-message-id="${escapeHtml(message.id)}">
      ${content}
      <span class="message-meta"><time>${formatMessageTime(message.createdAt, language)}</time>${sent && !message.deletedAt && !failed ? `<button class="message-delete" type="button" data-action="delete-message" data-message-id="${escapeHtml(message.id)}">${ui.remove.split(" ")[0]}</button>` : ""}</span>
      ${failed ? `<span class="message-failed">${ui.sendFailed}<button type="button" data-action="retry-message" data-message-id="${escapeHtml(message.id)}">${ui.retry}</button></span>` : ""}
    </li>`;
  }).join("");
  $("#loadOlderButton").hidden = !state.nextCursor;
  if (preserveScroll) scroller.scrollTop += scroller.scrollHeight - previousHeight;
  else if (nearBottom || state.messages.length <= 1) requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
}

function setTypingIndicator(typing, profile = state.activeConversation?.profile) {
  const indicator = $("#typingIndicator");
  if (!indicator) return;
  indicator.hidden = !typing;
  indicator.innerHTML = typing ? `${escapeHtml(profile?.displayName || profile?.username || "FuelPhysique member")} ${escapeHtml(ui.typing)} <span aria-hidden="true"><i></i><i></i><i></i></span>` : "";
}

function stopTypingChannel() {
  if (state.typingStopTimer) clearTimeout(state.typingStopTimer);
  state.typingStopTimer = null;
  if (state.typingActive && state.activeConversation) {
    api(`/conversations/${encodeURIComponent(state.activeConversation.id)}/typing`, { method: "POST", body: JSON.stringify({ typing: false }) }).catch(() => {});
  }
  state.typingActive = false;
  state.typingAbort?.abort();
  state.typingAbort = null;
  state.typingReader = null;
  setTypingIndicator(false);
}

function sendTypingState(typing) {
  if (!state.activeConversation) return;
  state.typingActive = typing;
  api(`/conversations/${encodeURIComponent(state.activeConversation.id)}/typing`, { method: "POST", body: JSON.stringify({ typing }) }).catch(() => {});
  if (state.typingStopTimer) clearTimeout(state.typingStopTimer);
  if (typing) state.typingStopTimer = setTimeout(() => stopTypingChannel(), 2800);
}

async function startTypingChannel(conversationId) {
  state.typingAbort?.abort();
  const controller = new AbortController();
  state.typingAbort = controller;
  try {
    const token = await state.user.getIdToken();
    const response = await fetch(`/api/social/conversations/${encodeURIComponent(conversationId)}/typing/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    if (!response.ok || !response.body) return;
    const reader = response.body.getReader();
    state.typingReader = reader;
    const decoder = new TextDecoder();
    let buffer = "";
    while (!controller.signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        const line = event.split("\n").find((item) => item.startsWith("data: "));
        if (!line) continue;
        const payload = JSON.parse(line.slice(6));
        if (payload.type === "typing" && payload.uid !== state.user.uid) setTypingIndicator(payload.typing);
      }
    }
  } catch (error) {
    if (error.name !== "AbortError") console.warn("Typing channel unavailable", error?.message || error);
  }
}

function subscribeToActiveConversation() {
  state.unsubscribe?.();
  state.unsubscribe = null;
  if (!state.activeConversation) return;
  const conversationId = state.activeConversation.id;
  const messageQuery = query(collection(db, "conversations", conversationId, "messages"), orderBy("createdAt", "desc"), limit(25));
  state.unsubscribe = onSnapshot(messageQuery, (snapshot) => {
    if (state.activeConversation?.id !== conversationId) return;
    const incoming = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).reverse();
    state.messages = mergeMessages(state.messages.filter((message) => message.status === "failed"), incoming);
    renderMessages();
  }, (error) => {
    console.warn("Social message listener unavailable", error?.code);
    const message = error?.code === "permission-denied" ? ui.liveChatPermission
      : error?.code === "failed-precondition" ? ui.liveChatIndex
      : ui.liveChatUnavailable;
    toast(message, true);
  });
}

async function openConversation(conversationOrId) {
  stopTypingChannel();
  state.unsubscribe?.();
  state.unsubscribe = null;
  setView("messages");
  let conversation = typeof conversationOrId === "string" ? state.conversations.find((item) => item.id === conversationOrId) : conversationOrId;
  if (!conversation) return;
  state.activeConversation = conversation;
  state.messages = [];
  state.nextCursor = null;
  renderConversations();
  $("#chatEmpty").hidden = true;
  $("#chatPanel").hidden = false;
  $("#chatFriendName").textContent = conversation.profile?.displayName || conversation.profile?.username || "FuelPhysique member";
  $("#chatFriendUsername").textContent = conversation.profile?.username ? `@${conversation.profile.username}` : "";
  $("#chatAvatar").innerHTML = avatar({ ...conversation.profile, interactive: true }, true);
  $("#messageSkeletons").hidden = false;
  try {
    const data = await api(`/conversations/${encodeURIComponent(conversation.id)}/messages`);
    state.messages = data.messages || [];
    state.nextCursor = data.nextCursor;
    renderMessages();
    await api(`/conversations/${encodeURIComponent(conversation.id)}/read`, { method: "POST" });
    conversation.unreadCount = 0;
    renderConversations();
    subscribeToActiveConversation();
    startTypingChannel(conversation.id);
  } catch (error) {
    toast(error.message, true);
  } finally {
    $("#messageSkeletons").hidden = true;
  }
}

async function startConversation(friendUid) {
  const data = await api("/conversations", { method: "POST", body: JSON.stringify({ friendUid }) });
  const conversation = data.conversation;
  const existingIndex = state.conversations.findIndex((item) => item.id === conversation.id);
  if (existingIndex >= 0) state.conversations[existingIndex] = { ...state.conversations[existingIndex], ...conversation };
  else state.conversations.unshift(conversation);
  renderConversations();
  await openConversation(conversation);
}

async function relationshipAction(button) {
  const action = button.dataset.action;
  const uid = button.dataset.uid;
  button.disabled = true;
  try {
    if (["accept", "decline", "cancel"].includes(action)) {
      await api(`/friend-requests/${encodeURIComponent(button.dataset.requestId)}`, { method: "PATCH", body: JSON.stringify({ action }) });
    } else if (action === "request") {
      await api("/friend-requests", { method: "POST", body: JSON.stringify({ targetUid: uid }) });
    } else if (action === "message") {
      await startConversation(uid);
      return;
    } else if (action === "remove") {
      if (!window.confirm(language === "he" ? "להסיר את החבר?" : "Remove this friend?")) return;
      await api(`/friends/${encodeURIComponent(uid)}`, { method: "DELETE" });
    } else if (action === "block") {
      if (!window.confirm(language === "he" ? "לחסום את המשתמש? לא יהיה ניתן לשלוח הודעות חדשות." : "Block this user? New messages will stop immediately.")) return;
      await api("/blocks", { method: "POST", body: JSON.stringify({ targetUid: uid }) });
    } else if (action === "unblock") {
      await api(`/blocks/${encodeURIComponent(uid)}`, { method: "DELETE" });
    }
    await Promise.all([loadRelationships(), loadConversations()]);
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function searchUsers(event) {
  event.preventDefault();
  const queryValue = $("#userSearchInput").value.trim();
  if (queryValue.length < 3) {
    $("#searchStatus").textContent = ui.searchHint;
    return;
  }
  $("#searchStatus").textContent = ui.searching;
  try {
    const data = await api(`/users/search?q=${encodeURIComponent(queryValue)}&mode=prefix`);
    const friends = new Set(state.relationships.friends.map((item) => item.profile.uid));
    const pending = new Set([...state.relationships.sent, ...state.relationships.received].map((item) => item.profile.uid));
    $("#searchResultsSection").hidden = false;
    $("#searchResults").innerHTML = data.users.length ? data.users.map((profile) => personCard(profile, friends.has(profile.uid)
      ? [{ action: "message", label: ui.messageAction }]
      : pending.has(profile.uid) ? [{ action: "pending", label: ui.requested }] : [{ action: "request", label: ui.addFriend }])).join("") : `<p class="section-status">${ui.noResults}</p>`;
    $("#searchResults").querySelectorAll('[data-action="pending"]').forEach((button) => { button.disabled = true; });
    $("#searchStatus").textContent = "";
  } catch (error) {
    $("#searchStatus").textContent = error.message;
  }
}

async function sendMessage(event, retryText = null) {
  event?.preventDefault?.();
  if (!state.activeConversation) return;
  const input = $("#messageInput");
  const text = (retryText ?? input.value).trim();
  if (!text) return;
  stopTypingChannel();
  const clientId = safeClientId();
  const optimisticId = `sending_${clientId}`;
  const optimistic = { id: optimisticId, senderUid: state.user.uid, type: "text", text, createdAt: new Date().toISOString(), status: "sending", clientId };
  state.messages = mergeMessages(state.messages, [optimistic]);
  renderMessages();
  input.value = "";
  updateComposer();
  $("#sendButton").classList.add("is-sending");
  try {
    const data = await api(`/conversations/${encodeURIComponent(state.activeConversation.id)}/messages`, { method: "POST", body: JSON.stringify({ text, clientId }) });
    state.messages = state.messages.filter((message) => message.id !== optimisticId);
    if (data.message) state.messages = mergeMessages(state.messages, [data.message]);
    state.failedMessages.delete(optimisticId);
    renderMessages();
    await loadConversations();
  } catch (error) {
    optimistic.status = "failed";
    state.failedMessages.set(optimisticId, { text });
    state.messages = mergeMessages(state.messages.filter((message) => message.id !== optimisticId), [optimistic]);
    renderMessages();
  } finally {
    if (state.activeConversation) startTypingChannel(state.activeConversation.id);
    window.setTimeout(() => $("#sendButton").classList.remove("is-sending"), 450);
  }
}

function updateComposer() {
  const input = $("#messageInput");
  $("#messageCounter").textContent = `${[...input.value].length}/2000`;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
}

async function loadOlderMessages() {
  if (!state.nextCursor || !state.activeConversation) return;
  const button = $("#loadOlderButton");
  button.disabled = true;
  try {
    const data = await api(`/conversations/${encodeURIComponent(state.activeConversation.id)}/messages?before=${encodeURIComponent(state.nextCursor)}`);
    state.messages = mergeMessages(data.messages || [], state.messages);
    state.nextCursor = data.nextCursor;
    renderMessages({ preserveScroll: true });
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function shareTypeLabel(type) {
  return ui[type] || type.replaceAll("_", " ");
}

async function openShareDialog(type, preferredSourceId = "") {
  state.shareType = type;
  $("#shareDialogTitle").textContent = `${ui.shareWithFriend}: ${shareTypeLabel(type)}`;
  $("#shareError").textContent = "";
  $("#privacyFieldset").hidden = !["weight_progress", "progress_graph"].includes(type);
  $("#shareConversationSelect").innerHTML = state.conversations.map((conversation) => `<option value="${escapeHtml(conversation.id)}"${conversation.id === state.activeConversation?.id ? " selected" : ""}>${profileName(conversation.profile)} ${username(conversation.profile)}</option>`).join("");
  $("#shareSourceSelect").innerHTML = `<option>${ui.loading}</option>`;
  $("#shareDialog").showModal();
  try {
    const data = await api(`/share-sources?type=${encodeURIComponent(type)}`);
    state.shareSources = data.sources || [];
    $("#shareSourceSelect").innerHTML = state.shareSources.map((source) => `<option value="${escapeHtml(source.id)}"${source.id === preferredSourceId ? " selected" : ""}>${escapeHtml(source.title || source.id)}</option>`).join("");
    updateShareSummary();
  } catch (error) {
    $("#shareError").textContent = error.message;
    $("#shareSourceSelect").innerHTML = "";
  }
}

function updateShareSummary() {
  const source = state.shareSources.find((item) => item.id === $("#shareSourceSelect").value);
  const privacy = document.querySelector('input[name="privacyMode"]:checked')?.value;
  $("#shareSummary").innerHTML = source
    ? `<strong>${escapeHtml(source.title)}</strong><p>${escapeHtml(shareTypeLabel(state.shareType))}${privacy ? ` · ${escapeHtml(ui[`privacy${privacy === "total_change" ? "Total" : privacy === "percentage_change" ? "Percent" : privacy === "trend_only" ? "Trend" : "Exact"}`])}` : ""}</p>${privacy === "exact_values" ? `<p>${escapeHtml(ui.exactValuesWarning)}</p>` : ""}`
    : `<p>${escapeHtml(ui.noData)}</p>`;
}

async function shareArtifact(event) {
  event.preventDefault();
  const conversationId = $("#shareConversationSelect").value;
  const sourceId = $("#shareSourceSelect").value;
  if (!conversationId || !sourceId) return;
  const button = $("#confirmShareButton");
  button.disabled = true;
  button.textContent = ui.sending;
  try {
    await api(`/conversations/${encodeURIComponent(conversationId)}/artifacts`, {
      method: "POST",
      body: JSON.stringify({
        type: state.shareType,
        sourceId,
        privacyMode: document.querySelector('input[name="privacyMode"]:checked')?.value || undefined,
        clientId: safeClientId()
      })
    });
    $("#shareDialog").close();
    toast(ui.sharedSuccess);
    const conversation = state.conversations.find((item) => item.id === conversationId);
    if (conversation) await openConversation(conversation);
    await loadConversations();
  } catch (error) {
    $("#shareError").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = ui.shareWithFriend;
  }
}

// Optional one-line focus summary on a shared plan. Renders only when the
// snapshot actually carries a non-balanced focus, so nothing changes for
// balanced plans or for snapshots produced before these fields existed.
// Muscle ids only -- no personal information is added to a shared artifact.
const SHARED_FOCUS_LABELS = Object.freeze({
  chest: "Chest", back: "Back", delts: "Shoulders / Delts", rear_delts: "Rear Delts",
  traps: "Traps", biceps: "Biceps", triceps: "Triceps", core: "Core / Abs",
  glutes: "Glutes", quads: "Quads", hamstrings: "Hamstrings", calves: "Calves"
});

function sharedFocusSummary(snapshot) {
  const mode = snapshot?.muscleFocusMode;
  if (!mode || mode === "balanced") return "";
  const ids = Array.isArray(snapshot.selectedMuscles) ? snapshot.selectedMuscles : [];
  const names = ids.map((id) => SHARED_FOCUS_LABELS[id]).filter(Boolean);
  if (!names.length) return "";
  return `<p><strong>Focus:</strong> ${names.map(escapeHtml).join(", ")}</p>`;
}

function workoutPreview(snapshot) {
  const muscles = Object.entries(snapshot.weeklyVolume?.perMuscle || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(1, ...muscles.map(([, value]) => value));
  return `<div class="preview-summary-grid">
    <article><strong>${snapshot.daysPerWeek || snapshot.sessions?.length || 0}</strong><span>${ui.days}</span></article>
    <article><strong>${snapshot.sessions?.length || 0}</strong><span>${ui.sessions}</span></article>
    <article><strong>${snapshot.estimatedSessionMinutes || "—"}</strong><span>min</span></article>
    <article><strong>${escapeHtml(snapshot.goal || "—")}</strong><span>Goal</span></article>
  </div>
  ${snapshot.equipment?.length ? `<p><strong>Equipment:</strong> ${snapshot.equipment.map(escapeHtml).join(", ")}</p>` : ""}
  ${sharedFocusSummary(snapshot)}
  ${muscles.length ? `<section><h3>Weekly volume</h3><div class="volume-bars">${muscles.map(([muscle, value]) => `<div class="volume-bar"><span>${escapeHtml(muscle)}</span><i style="--bar:${Math.round(value / max * 100)}%"></i><b>${escapeHtml(value)}</b></div>`).join("")}</div></section>` : ""}
  <nav class="preview-session-nav" aria-label="Workout sessions">${(snapshot.sessions || []).map((session, index) => `<a href="#shared-session-${index}">${index + 1}. ${escapeHtml(session.name)}</a>`).join("")}</nav>
  <div>${(snapshot.sessions || []).map((session, sessionIndex) => `<section class="preview-session" id="shared-session-${sessionIndex}" tabindex="-1"><h3>${sessionIndex + 1}. ${escapeHtml(session.name)}</h3>${(session.exercises || []).map((exercise) => `<div class="exercise-preview-row"><img src="/images/exercises/${encodeURIComponent(exercise.exerciseId)}.png" alt="" loading="lazy" onerror="this.src='/images/exercises/fuelphysique-demo-fallback.svg'"><div><strong>${escapeHtml(exercise.name)}</strong><span>${escapeHtml(exercise.sets)} ${ui.sets} · ${escapeHtml(exercise.reps)} ${ui.targetReps} · ${escapeHtml(exercise.restSeconds)}s ${ui.rest}${exercise.rir ? ` · ${escapeHtml(ui.effortRir(exercise.rir))}` : ""}</span></div><span>${escapeHtml(exercise.equipment || "")}</span></div>`).join("")}</section>`).join("")}</div>`;
}

function nutritionPreview(snapshot) {
  const totals = snapshot.totals || {};
  return `<div class="preview-summary-grid">
    <article><strong>${Math.round(totals.calories || 0)}</strong><span>${ui.calories}</span></article>
    <article><strong>${Math.round(totals.proteinGrams || 0)}g</strong><span>Protein</span></article>
    <article><strong>${Math.round(totals.carbsGrams || 0)}g</strong><span>Carbs</span></article>
    <article><strong>${Math.round(totals.fatGrams || 0)}g</strong><span>Fat</span></article>
    <article><strong>${snapshot.mealCount || snapshot.meals?.length || 0}</strong><span>${ui.meals}</span></article>
  </div>
  <div>${(snapshot.meals || []).map((meal, index) => `<section class="preview-meal"><h3>${index + 1}. ${escapeHtml(meal.name)}</h3>${(meal.foods || []).map((food) => `<div class="food-preview-row">${food.image ? `<img src="${escapeHtml(food.image)}" alt="" loading="lazy">` : `<span class="avatar">${escapeHtml(food.name[0] || "F")}</span>`}<div><strong>${escapeHtml(food.name)}</strong><span>${escapeHtml(food.amount)}</span></div><span>${Math.round(food.calories || 0)} ${ui.calories}</span></div>`).join("")}<p>${Math.round(meal.calories || 0)} ${ui.calories} · P ${Math.round(meal.proteinGrams || 0)}g · C ${Math.round(meal.carbsGrams || 0)}g · F ${Math.round(meal.fatGrams || 0)}g</p></section>`).join("")}</div>`;
}

function graphPreview(snapshot) {
  const points = snapshot.privacyMode === "exact_values" ? snapshot.points : snapshot.trend;
  const polyline = graphPolyline(points);
  const summary = snapshot.summary || {};
  const change = summary.totalChange !== null && summary.totalChange !== undefined ? `${summary.totalChange > 0 ? "+" : ""}${Math.round(summary.totalChange * 100) / 100} ${escapeHtml(snapshot.unit || "")}` : summary.percentageChange !== null && summary.percentageChange !== undefined ? `${summary.percentageChange > 0 ? "+" : ""}${Math.round(summary.percentageChange * 10) / 10}%` : summary.direction;
  return `<section class="graph-preview"><svg viewBox="0 0 720 260" role="img" aria-labelledby="graphAccessibleTitle graphAccessibleDesc"><title id="graphAccessibleTitle">${escapeHtml(snapshot.title)}</title><desc id="graphAccessibleDesc">${escapeHtml(`${snapshot.dateRange?.from || ""} to ${snapshot.dateRange?.to || ""}. ${change}.`)}</desc>${[55,105,155,205].map((y) => `<line class="graph-grid" x1="28" y1="${y}" x2="692" y2="${y}"></line>`).join("")}<polyline class="graph-line" points="${escapeHtml(polyline)}"></polyline></svg><p class="graph-summary"><strong>${ui.graphSummary}:</strong> ${escapeHtml(snapshot.dateRange?.from || "")} – ${escapeHtml(snapshot.dateRange?.to || "")} · ${escapeHtml(change)}</p></section>`;
}

function simpleArtifactPreview(type, snapshot) {
  if (type === "personal_record") return `<article class="preview-record"><span class="eyebrow">${ui.personal_record}</span><h2>${escapeHtml(snapshot.exerciseName)}</h2><p><strong>${escapeHtml(snapshot.value)} ${escapeHtml(snapshot.unit)}</strong>${snapshot.repetitions ? ` × ${escapeHtml(snapshot.repetitions)}` : ""}</p><p>${escapeHtml(snapshot.achievedDate || "")}</p>${snapshot.note ? `<p>${escapeHtml(snapshot.note)}</p>` : ""}<a class="secondary-button" href="/exercise-progress.html?exercise=${encodeURIComponent(snapshot.exerciseId || "")}">Open exercise</a></article>`;
  if (type === "completed_workout") return `<div class="preview-summary-grid"><article><strong>${Math.round((snapshot.durationSeconds || 0) / 60)}</strong><span>min</span></article><article><strong>${snapshot.completedSets || 0}</strong><span>${ui.sets}</span></article><article><strong>${snapshot.exercises?.length || 0}</strong><span>exercises</span></article></div><section class="preview-session">${(snapshot.exercises || []).map((exercise) => `<div class="exercise-preview-row"><img src="/images/exercises/${encodeURIComponent(exercise.exerciseId)}.png" alt="" onerror="this.src='/images/exercises/fuelphysique-demo-fallback.svg'"><div><strong>${escapeHtml(exercise.name)}</strong><span>${exercise.completedSets} ${ui.sets}</span></div></div>`).join("")}</section>`;
  return graphPreview(snapshot);
}

function stopArtifactSubscription() {
  state.unsubscribeArtifact?.();
  state.unsubscribeArtifact = null;
}

async function previewArtifact(artifactId) {
  stopArtifactSubscription();
  if (!history.state?.socialPreview) history.pushState({ socialPreview: artifactId }, "");
  $("#previewDialog").showModal();
  $("#previewTitle").textContent = ui.loading;
  $("#previewContent").innerHTML = `<div class="skeleton-list"><span></span><span></span><span></span></div>`;
  $("#previewStatus").textContent = "";
  try {
    const data = await api(`/artifacts/${encodeURIComponent(artifactId)}`);
    const artifact = data.artifact;
    state.activeArtifact = artifact;
    state.unsubscribeArtifact = onSnapshot(doc(db, "sharedArtifacts", artifact.id), (snapshot) => {
      if (snapshot.exists && snapshot.data()?.revokedAt) {
        state.activeArtifact = { ...state.activeArtifact, unavailable: true };
        $("#previewContent").innerHTML = `<div class="empty-state"><h3>${ui.unavailable}</h3></div>`;
        $("#copyArtifactButton").hidden = true;
      }
    }, () => {});
    $("#previewType").textContent = shareTypeLabel(artifact.type).toUpperCase();
    $("#previewTitle").textContent = artifact.snapshot?.title || artifact.snapshot?.exerciseName || shareTypeLabel(artifact.type);
    $("#previewAttribution").textContent = `${ui.createdBy} @${artifact.snapshot?.creatorUsername || artifact.metadata?.creatorUsername || "FuelPhysique"}`;
    const copyable = ["workout", "nutrition"].includes(artifact.type) && !artifact.unavailable;
    $("#copyArtifactButton").hidden = !copyable;
    $("#copyArtifactButton").textContent = artifact.compatibilityWarnings?.length ? ui.copyAsIs : artifact.type === "nutrition" ? ui.copyNutrition : ui.copyWorkout;
    $("#previewWarnings").hidden = !artifact.compatibilityWarnings?.length;
    $("#previewWarnings").innerHTML = (artifact.compatibilityWarnings || []).map((warning) => `<p>${escapeHtml(warning)}</p>`).join("");
    if (artifact.unavailable) {
      $("#previewContent").innerHTML = `<div class="empty-state"><h3>${ui.unavailable}</h3></div>`;
      return;
    }
    $("#previewContent").innerHTML = artifact.type === "workout" ? workoutPreview(artifact.snapshot)
      : artifact.type === "nutrition" ? nutritionPreview(artifact.snapshot)
      : simpleArtifactPreview(artifact.type, artifact.snapshot);
  } catch (error) {
    $("#previewContent").innerHTML = `<div class="empty-state"><h3>${escapeHtml(error.message)}</h3></div>`;
    $("#copyArtifactButton").hidden = true;
  }
}

async function copyArtifact(artifactId = state.activeArtifact?.id) {
  if (!artifactId) return;
  const button = $("#copyArtifactButton");
  button.disabled = true;
  button.textContent = ui.loading;
  try {
    const result = await api(`/artifacts/${encodeURIComponent(artifactId)}/copy`, { method: "POST" });
    state.copiedArtifacts.set(artifactId, result);
    $("#previewStatus").innerHTML = `${escapeHtml(ui.copiedSuccess)} <a href="/${result.collection === "nutritionPlans" ? "my-nutrition-plans" : "my-workout-plans"}.html">${escapeHtml(ui.openCopy)}</a>`;
    button.textContent = ui.copied;
    renderMessages();
  } catch (error) {
    $("#previewStatus").textContent = error.message;
    button.textContent = state.activeArtifact?.type === "nutrition" ? ui.copyNutrition : ui.copyWorkout;
  } finally {
    button.disabled = false;
  }
}

async function messageListAction(button) {
  const action = button.dataset.action;
  if (action === "preview-artifact") return previewArtifact(button.dataset.artifactId);
  if (action === "copy-artifact") {
    await previewArtifact(button.dataset.artifactId);
    return copyArtifact(button.dataset.artifactId);
  }
  if (action === "delete-message") {
    try {
      await api(`/conversations/${encodeURIComponent(state.activeConversation.id)}/messages/${encodeURIComponent(button.dataset.messageId)}`, { method: "DELETE" });
      const message = state.messages.find((item) => item.id === button.dataset.messageId);
      if (message) { message.deletedAt = new Date().toISOString(); message.text = ""; }
      renderMessages();
    } catch (error) { toast(error.message, true); }
  }
  if (action === "retry-message") {
    const failed = state.failedMessages.get(button.dataset.messageId);
    state.messages = state.messages.filter((message) => message.id !== button.dataset.messageId);
    state.failedMessages.delete(button.dataset.messageId);
    renderMessages();
    if (failed) await sendMessage(null, failed.text);
  }
}

async function saveIdentity(event) {
  event.preventDefault();
  const button = $("#saveUsernameButton");
  button.disabled = true;
  $("#identityError").textContent = "";
  try {
    const data = await api("/identity/username", { method: "PUT", body: JSON.stringify({ username: $("#usernameInput").value, discoverable: $("#discoverableInput").checked }) });
    state.profile = data.profile;
    $("#identityGate").hidden = true;
    $("#socialApp").hidden = false;
    renderIdentityCard();
    await Promise.all([loadRelationships(), loadConversations()]);
    startRealtimeSubscriptions();
    toast(ui.usernameSaved);
  } catch (error) {
    $("#identityError").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function renderProfilePreview(profile) {
  $("#profilePreviewAvatar").innerHTML = avatar(profile, true).replace(/data-profile-uid="[^"]*"/g, "");
  $("#profilePreviewTitle").textContent = profile.displayName || profile.username || ui.profile;
  $("#profilePreviewUsername").textContent = profile.username ? `@${profile.username}` : "";
  $("#profilePreviewBio").textContent = profile.bio || "";
  $("#profilePreviewBadges").innerHTML = badgeMarkup(profile);
  const action = $("#profilePreviewAction");
  const friend = state.relationships.friends.some((item) => item.profile.uid === profile.uid);
  const pending = [...state.relationships.sent, ...state.relationships.received].some((item) => item.profile.uid === profile.uid);
  action.hidden = profile.uid === state.user.uid;
  action.textContent = friend ? ui.messageAction : pending ? ui.requested : ui.addFriend;
  action.disabled = pending;
  action.dataset.profileAction = friend ? "message" : "request";
  action.dataset.uid = profile.uid;
}

async function openProfilePreview(uid) {
  try {
    const data = await api(`/profiles/${encodeURIComponent(uid)}`);
    renderProfilePreview(data.profile);
    $("#profileDialog").showModal();
  } catch (error) {
    toast(error.message, true);
  }
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#identityForm").addEventListener("submit", saveIdentity);
  $("#userSearchForm").addEventListener("submit", searchUsers);
  $("#friendsView").addEventListener("click", (event) => {
    const profileTarget = event.target.closest("[data-profile-uid]");
    if (profileTarget) { openProfilePreview(profileTarget.dataset.profileUid); return; }
    const button = event.target.closest("button[data-action]");
    if (button) relationshipAction(button);
  });
  $("#conversationList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-conversation-id]");
    if (card) openConversation(card.dataset.conversationId);
  });
  $("#newConversationButton").addEventListener("click", () => { setView("friends"); $("#userSearchInput").focus(); });
  $("#chatFindFriendsButton").addEventListener("click", () => setView("friends"));
  $("#messageForm").addEventListener("submit", sendMessage);
  $("#messageInput").addEventListener("input", () => {
    updateComposer();
    sendTypingState(Boolean($("#messageInput").value.trim()));
  });
  $("#messageInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendMessage(event); }
  });
  $("#loadOlderButton").addEventListener("click", loadOlderMessages);
  $("#messageList").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) messageListAction(button);
  });
  $("#shareMenuButton").addEventListener("click", () => {
    const menu = $("#shareMenu");
    menu.hidden = !menu.hidden;
    $("#shareMenuButton").setAttribute("aria-expanded", String(!menu.hidden));
  });
  $("#shareMenu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-share-type]");
    if (!button) return;
    $("#shareMenu").hidden = true;
    $("#shareMenuButton").setAttribute("aria-expanded", "false");
    openShareDialog(button.dataset.shareType);
  });
  $("#shareForm").addEventListener("submit", shareArtifact);
  $("#shareSourceSelect").addEventListener("change", updateShareSummary);
  document.querySelectorAll('input[name="privacyMode"]').forEach((input) => input.addEventListener("change", updateShareSummary));
  $("#closePreviewButton").addEventListener("click", () => {
    stopArtifactSubscription();
    if (history.state?.socialPreview) history.back();
    else $("#previewDialog").close();
  });
  $("#copyArtifactButton").addEventListener("click", () => copyArtifact());
  $("#mobileConversationBack").addEventListener("click", () => $("#socialApp").classList.add("show-conversations"));
  $("#chatFriendMenu").addEventListener("click", async () => {
    const targetUid = state.activeConversation?.profile?.uid;
    if (!targetUid || !window.confirm(language === "he" ? "לחסום את המשתמש?" : "Block this user and stop new messages?")) return;
    try { stopTypingChannel(); await api("/blocks", { method: "POST", body: JSON.stringify({ targetUid }) }); state.activeConversation = null; $("#chatPanel").hidden = true; $("#chatEmpty").hidden = false; await Promise.all([loadRelationships(), loadConversations()]); }
    catch (error) { toast(error.message, true); }
  });
  $("#chatAvatar").addEventListener("click", (event) => {
    const profileTarget = event.target.closest("[data-profile-uid]");
    if (profileTarget) openProfilePreview(state.activeConversation?.profile?.uid);
  });
  $("#profilePreviewAction").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.dataset.profileAction === "message") {
      $("#profileDialog").close();
      await startConversation(button.dataset.uid);
    } else if (button.dataset.profileAction === "request") {
      button.disabled = true;
      try { await api("/friend-requests", { method: "POST", body: JSON.stringify({ targetUid: button.dataset.uid }) }); $("#profileDialog").close(); await Promise.all([loadRelationships(), loadConversations()]); }
      catch (error) { toast(error.message, true); button.disabled = false; }
    }
  });
  window.addEventListener("popstate", () => {
    stopArtifactSubscription();
    if ($("#previewDialog").open) $("#previewDialog").close();
  });
}

function cleanupSocial() {
  stopTypingChannel();
  state.unsubscribe?.();
  state.unsubscribe = null;
  stopArtifactSubscription();
  stopRealtimeSubscriptions();
}

async function initialize(currentUser) {
  state.user = currentUser;
  try {
    await loadSavedLanguage();
    const data = await api("/identity");
    state.profile = data.profile;
    if (!state.profile) {
      $("#identityGate").hidden = false;
      $("#socialApp").hidden = true;
      $("#usernameInput").focus();
      return;
    }
    $("#identityGate").hidden = true;
    $("#socialApp").hidden = false;
    renderIdentityCard();
    await Promise.all([loadRelationships(), loadConversations()]);
    startRealtimeSubscriptions();
    const params = new URLSearchParams(location.search);
    const shareType = params.get("share");
    if (shareType && state.conversations.length) await openShareDialog(shareType, params.get("sourceId") || "");
  } catch (error) {
    $("#globalStatus").classList.remove("sr-only");
    $("#globalStatus").textContent = error.message;
    toast(error.message, true);
  }
}

applyTranslations();
bindEvents();
guardProtectedPage({ onAuthenticated: initialize, onSignedOut: cleanupSocial });
window.addEventListener("beforeunload", () => {
  cleanupSocial();
});
