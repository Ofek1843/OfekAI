import { auth } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  createConversation,
  saveMessage,
  getRecentConversations,
  getConversationMessages
} from "./conversations.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    return;
  }

  try {
    const conversationId = await createConversation({
      title: "Firestore Test",
      category: "test"
    });

    await saveMessage({
      conversationId,
      role: "user",
      content: "Test user message"
    });

    await saveMessage({
      conversationId,
      role: "assistant",
      content: "Test assistant response"
    });

    const conversations = await getRecentConversations();
    const messages = await getConversationMessages(conversationId);

    console.log("Firestore test completed");
    console.log("Conversation ID:", conversationId);
    console.log("Conversations:", conversations);
    console.log("Messages:", messages);
  } catch (error) {
    console.error("Firestore test failed:", error);
  }
});