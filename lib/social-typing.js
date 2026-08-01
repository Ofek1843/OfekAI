"use strict";

const streams = new Map();
const timers = new Map();

function bucket(conversationId) {
  if (!streams.has(conversationId)) streams.set(conversationId, new Map());
  return streams.get(conversationId);
}

function addStream(conversationId, uid, response) {
  const users = bucket(conversationId);
  if (!users.has(uid)) users.set(uid, new Set());
  users.get(uid).add(response);
  return () => {
    users.get(uid)?.delete(response);
    if (!users.get(uid)?.size) users.delete(uid);
    if (!users.size) streams.delete(conversationId);
  };
}

function broadcast(conversationId, senderUid, typing) {
  const users = streams.get(conversationId);
  if (!users) return;
  for (const [uid, responses] of users) {
    if (uid === senderUid) continue;
    for (const response of responses) {
      response.write(`data: ${JSON.stringify({ type: "typing", uid: senderUid, typing: Boolean(typing) })}\n\n`);
    }
  }
}

function setTyping(conversationId, uid, typing) {
  const key = `${conversationId}:${uid}`;
  if (timers.has(key)) clearTimeout(timers.get(key));
  if (typing) timers.set(key, setTimeout(() => {
    timers.delete(key);
    broadcast(conversationId, uid, false);
  }, 3000));
  broadcast(conversationId, uid, typing);
}

function stopForUser(uid) {
  for (const [conversationId, users] of streams) {
    if (users.has(uid)) {
      const key = `${conversationId}:${uid}`;
      if (timers.has(key)) clearTimeout(timers.get(key));
      timers.delete(key);
      broadcast(conversationId, uid, false);
    }
  }
}

function closeAll() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  for (const users of streams.values()) for (const responses of users.values()) for (const response of responses) response.end();
  streams.clear();
}

module.exports = { addStream, setTyping, stopForUser, closeAll };
