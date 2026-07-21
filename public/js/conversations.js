import { auth, db } from "./firebase-config.js";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/**
 * Creates a new conversation for the currently signed-in user.
 */
export async function createConversation({
  title = "New Conversation",
  category = "general"
} = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User must be signed in.");
  }

  const conversationsRef = collection(
    db,
    "users",
    user.uid,
    "conversations"
  );

  const conversationRef = await addDoc(conversationsRef, {
    title: String(title || "New Conversation").trim(),
    category,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: ""
  });

  return conversationRef.id;
}

/**
 * Updates the title of an existing conversation.
 */
export async function updateConversationTitle({
  conversationId,
  title
}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User must be signed in.");
  }

  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  const cleanTitle = String(title || "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  if (!cleanTitle) {
    throw new Error("Conversation title cannot be empty.");
  }

  const conversationRef = doc(
    db,
    "users",
    user.uid,
    "conversations",
    conversationId
  );

  await updateDoc(conversationRef, {
    title: cleanTitle,
    updatedAt: serverTimestamp()
  });
}

/**
 * Saves one message inside a conversation.
 */
export async function saveMessage({
  conversationId,
  role,
  content
}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User must be signed in.");
  }

  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  if (!["user", "assistant", "system"].includes(role)) {
    throw new Error("Invalid message role.");
  }

  const cleanContent = String(content || "").trim();

  if (!cleanContent) {
    throw new Error("Message content cannot be empty.");
  }

  const conversationRef = doc(
    db,
    "users",
    user.uid,
    "conversations",
    conversationId
  );

  const messagesRef = collection(conversationRef, "messages");

  await addDoc(messagesRef, {
    role,
    content: cleanContent,
    createdAt: serverTimestamp()
  });

  await updateDoc(conversationRef, {
    lastMessage: cleanContent.slice(0, 160),
    updatedAt: serverTimestamp()
  });
}

/**
 * Loads the user's most recent conversations.
 */
export async function getRecentConversations(maxResults = 20) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User must be signed in.");
  }

  const conversationsRef = collection(
    db,
    "users",
    user.uid,
    "conversations"
  );

  const conversationsQuery = query(
    conversationsRef,
    orderBy("updatedAt", "desc"),
    limit(maxResults)
  );

  const snapshot = await getDocs(conversationsQuery);

  return snapshot.docs.map((conversationDocument) => ({
    id: conversationDocument.id,
    ...conversationDocument.data()
  }));
}

/**
 * Loads messages from one conversation in chronological order.
 */
export async function getConversationMessages(conversationId) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User must be signed in.");
  }

  if (!conversationId) {
    throw new Error("conversationId is required.");
  }

  const messagesRef = collection(
    db,
    "users",
    user.uid,
    "conversations",
    conversationId,
    "messages"
  );

  const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc")
  );

  const snapshot = await getDocs(messagesQuery);

  return snapshot.docs.map((messageDocument) => ({
    id: messageDocument.id,
    ...messageDocument.data()
  }));
}

export async function deleteConversation(conversationId) {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be signed in.");
  if (!conversationId) throw new Error("conversationId is required.");

  const conversationRef = doc(db, "users", user.uid, "conversations", conversationId);
  const messagesSnapshot = await getDocs(collection(conversationRef, "messages"));
  const messageDocs = messagesSnapshot.docs;

  for (let index = 0; index < messageDocs.length; index += 400) {
    const batch = writeBatch(db);
    messageDocs.slice(index, index + 400).forEach((message) => batch.delete(message.ref));
    await batch.commit();
  }

  const finalBatch = writeBatch(db);
  finalBatch.delete(conversationRef);
  await finalBatch.commit();
}

export async function deleteAllConversations() {
  let conversations = await getRecentConversations(100);
  while (conversations.length) {
    for (const conversation of conversations) {
      await deleteConversation(conversation.id);
    }
    conversations = await getRecentConversations(100);
  }
}
