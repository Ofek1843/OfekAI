"use strict";

const {
  applicationDefault,
  cert,
  getApps,
  initializeApp
} = require("firebase-admin/app");
const {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore
} = require("firebase-admin/firestore");
const {
  SocialError,
  assertArtifactSize,
  buildNutritionCopy,
  buildWorkoutCopy,
  cleanString,
  cleanBio,
  derivePublicBadges,
  normalizeUsername,
  pairKey,
  sanitizeCompletedWorkoutSnapshot,
  sanitizeGraphSnapshot,
  sanitizeMessage,
  sanitizeNutritionSnapshot,
  sanitizeRecordSnapshot,
  sanitizeProfilePhotoURL,
  sanitizePublicBadges,
  publicRoleForBadges,
  sanitizeWorkoutSnapshot,
  stableMessageId,
  validateUsername
} = require("./social-domain");
const { normalizeEquipment } = require("./workout-validator");

const SOCIAL_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "ofek-ai-55f1d";
let cachedDb;

function socialFirestore() {
  if (cachedDb) return cachedDb;
  let app = getApps()[0];
  if (!app) {
    const rawServiceAccount = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
    const options = { projectId: SOCIAL_PROJECT_ID };
    if (rawServiceAccount) {
      try {
        options.credential = cert(JSON.parse(rawServiceAccount));
      } catch {
        throw new SocialError("social_store_misconfigured", "Social data access is not configured.", 503);
      }
    } else if (!process.env.FIRESTORE_EMULATOR_HOST) {
      options.credential = applicationDefault();
    }
    app = initializeApp(options, "fuelphysique-social");
  }
  cachedDb = getFirestore(app);
  return cachedDb;
}

function timestampNow() {
  return FieldValue.serverTimestamp();
}

function profileProjection(uid, data = {}) {
  const badges = sanitizePublicBadges(data.badges);
  if (!badges.length) badges.push("athlete");
  return {
    uid,
    username: cleanString(data.username, 20),
    usernameLower: normalizeUsername(data.usernameLower || data.username),
    displayName: cleanString(data.displayName, 80),
    initials: cleanString(data.initials, 3),
    photoURL: cleanString(data.photoURL, 1000),
    bio: cleanBio(data.bio),
    publicRole: publicRoleForBadges(badges),
    badges,
    discoverable: data.discoverable !== false,
    allowFriendRequests: data.allowFriendRequests !== false
  };
}

function initialsFor(name, username) {
  const source = cleanString(name || username, 80);
  const initials = source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => [...part][0]).join("").toUpperCase();
  return initials || "FP";
}

function documentData(snapshot) {
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function profilesFor(db, uids) {
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length) return new Map();
  const snapshots = await db.getAll(...unique.map((uid) => db.doc(`socialProfiles/${uid}`)));
  return new Map(snapshots.filter((item) => item.exists).map((item) => [item.id, profileProjection(item.id, item.data())]));
}

async function rootDisplayName(db, uid) {
  const user = await db.doc(`users/${uid}`).get();
  return cleanString(user.data()?.displayName || user.data()?.name, 80);
}

async function getIdentity(uid) {
  const db = socialFirestore();
  const snapshot = await db.doc(`socialProfiles/${uid}`).get();
  return snapshot.exists ? profileProjection(uid, snapshot.data()) : null;
}

async function reserveUsername(uid, input = {}) {
  const validated = validateUsername(input.username);
  if (!validated.ok) {
    throw new SocialError("invalid_username", "Use 3-20 letters, numbers, underscores or periods. Periods cannot repeat or appear at either end.", 400, validated.errors);
  }
  const db = socialFirestore();
  const profileRef = db.doc(`socialProfiles/${uid}`);
  const usernameRef = db.doc(`usernames/${validated.usernameLower}`);
  const displayName = cleanString(input.displayName, 80) || await rootDisplayName(db, uid) || validated.username;

  return db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    const previousKey = normalizeUsername(profileSnapshot.data()?.usernameLower || profileSnapshot.data()?.username);
    const previousRef = previousKey && previousKey !== validated.usernameLower ? db.doc(`usernames/${previousKey}`) : null;
    const usernameSnapshot = await transaction.get(usernameRef);
    const previousSnapshot = previousRef ? await transaction.get(previousRef) : null;
    const userSnapshot = await transaction.get(db.doc(`users/${uid}`));
    if (usernameSnapshot.exists && usernameSnapshot.data()?.uid !== uid) {
      throw new SocialError("username_taken", "That username is already taken.", 409);
    }
    if (previousSnapshot?.exists && previousSnapshot.data()?.uid !== uid) {
      throw new SocialError("username_state_conflict", "Your previous username reservation could not be verified.", 409);
    }
    const previousProfile = profileSnapshot.data() || {};
    const badges = derivePublicBadges({ storedBadges: previousProfile.badges, subscription: userSnapshot.data()?.subscription });
    const photoURL = input.photoURL === undefined
      ? cleanString(previousProfile.photoURL, 1000)
      : sanitizeProfilePhotoURL(input.photoURL);
    const safeProfile = {
      uid,
      username: validated.username,
      usernameLower: validated.usernameLower,
      displayName,
      initials: initialsFor(displayName, validated.username),
      photoURL,
      bio: input.bio === undefined ? cleanBio(previousProfile.bio) : cleanBio(input.bio),
      publicRole: publicRoleForBadges(badges),
      badges,
      discoverable: input.discoverable !== false,
      allowFriendRequests: input.allowFriendRequests !== false,
      schemaVersion: 1,
      updatedAt: timestampNow()
    };
    transaction.set(usernameRef, {
      uid,
      username: validated.username,
      usernameLower: validated.usernameLower,
      displayName,
      initials: safeProfile.initials,
      discoverable: safeProfile.discoverable,
      schemaVersion: 1,
      updatedAt: timestampNow(),
      ...(usernameSnapshot.exists ? {} : { createdAt: timestampNow() })
    }, { merge: true });
    transaction.set(profileRef, {
      ...safeProfile,
      ...(profileSnapshot.exists ? {} : { createdAt: timestampNow() })
    }, { merge: true });
    if (previousRef) transaction.delete(previousRef);
    return profileProjection(uid, safeProfile);
  });
}

async function searchUsers(uid, rawQuery, mode = "prefix") {
  const queryValue = normalizeUsername(rawQuery);
  if (queryValue.length < 3) return [];
  const db = socialFirestore();
  let snapshot;
  if (mode === "exact") {
    const exact = await db.doc(`usernames/${queryValue}`).get();
    snapshot = exact.exists ? [exact] : [];
  } else {
    snapshot = (await db.collection("usernames")
      .orderBy(FieldPath.documentId())
      .startAt(queryValue)
      .endAt(`${queryValue}\uf8ff`)
      .limit(10)
      .get()).docs;
  }
  return snapshot
    .map((item) => profileProjection(item.data().uid, item.data()))
    .filter((profile) => profile.uid !== uid && profile.discoverable);
}

async function getPublicProfile(requesterUid, targetUid) {
  const target = cleanString(targetUid, 128);
  if (!target) throw new SocialError("profile_not_found", "Profile not found.", 404);
  const profile = await getIdentity(target);
  if (!profile || (profile.uid !== requesterUid && !profile.discoverable)) {
    throw new SocialError("profile_not_found", "Profile not found.", 404);
  }
  return profile;
}

async function updatePublicProfile(uid, input = {}) {
  const current = await getIdentity(uid);
  if (!current) throw new SocialError("username_required", "Choose a username before editing your profile.", 409);
  return reserveUsername(uid, {
    ...input,
    username: input.username ?? current.username,
    displayName: input.displayName ?? current.displayName,
    bio: input.bio ?? current.bio,
    photoURL: input.photoURL ?? current.photoURL,
    discoverable: input.discoverable ?? current.discoverable,
    allowFriendRequests: input.allowFriendRequests ?? current.allowFriendRequests
  });
}

async function setTrustedBadges(targetUid, badges = []) {
  const db = socialFirestore();
  const ref = db.doc(`socialProfiles/${cleanString(targetUid, 128)}`);
  const requested = sanitizePublicBadges(badges).filter((badge) => ["coach", "developer"].includes(badge));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new SocialError("profile_not_found", "Profile not found.", 404);
    const current = snapshot.data() || {};
    const nextBadges = derivePublicBadges({ storedBadges: requested, subscription: (await transaction.get(db.doc(`users/${targetUid}`))).data()?.subscription });
    transaction.update(ref, { badges: nextBadges, publicRole: publicRoleForBadges(nextBadges), updatedAt: timestampNow() });
  });
  return getIdentity(targetUid);
}

async function blockExists(transaction, db, ownerUid, targetUid) {
  return (await transaction.get(db.doc(`users/${ownerUid}/blocks/${targetUid}`))).exists;
}

async function assertNotBlocked(transaction, db, firstUid, secondUid) {
  const firstBlocks = await blockExists(transaction, db, firstUid, secondUid);
  const secondBlocks = await blockExists(transaction, db, secondUid, firstUid);
  if (firstBlocks || secondBlocks) throw new SocialError("blocked", "This social action is unavailable.", 403);
}

async function sendFriendRequest(uid, targetUid) {
  if (uid === targetUid) throw new SocialError("self_request", "You cannot send a friend request to yourself.");
  const db = socialFirestore();
  const requestId = pairKey(uid, targetUid);
  const requestRef = db.doc(`friendRequests/${requestId}`);
  const friendshipRef = db.doc(`friendships/${requestId}`);
  return db.runTransaction(async (transaction) => {
    const fromProfile = await transaction.get(db.doc(`socialProfiles/${uid}`));
    const toProfile = await transaction.get(db.doc(`socialProfiles/${targetUid}`));
    const request = await transaction.get(requestRef);
    const friendship = await transaction.get(friendshipRef);
    await assertNotBlocked(transaction, db, uid, targetUid);
    if (!fromProfile.exists) throw new SocialError("username_required", "Choose a username before adding friends.", 409);
    if (!toProfile.exists || toProfile.data()?.allowFriendRequests === false) throw new SocialError("requests_disabled", "This user is not accepting friend requests.", 403);
    if (friendship.exists && friendship.data()?.status === "accepted") throw new SocialError("already_friends", "You are already friends.", 409);
    if (request.exists && request.data()?.status === "pending") {
      const opposite = request.data()?.fromUid !== uid;
      throw new SocialError(opposite ? "opposite_request_exists" : "duplicate_request", opposite ? "This user already sent you a request." : "A request is already pending.", 409);
    }
    transaction.set(requestRef, {
      requestId,
      fromUid: uid,
      toUid: targetUid,
      participants: [uid, targetUid].sort(),
      status: "pending",
      schemaVersion: 1,
      createdAt: timestampNow(),
      updatedAt: timestampNow()
    });
    return { requestId, status: "pending" };
  });
}

async function listRelationships(uid) {
  const db = socialFirestore();
  const [friendships, received, sent, blocks] = await Promise.all([
    db.collection("friendships").where("participants", "array-contains", uid).limit(100).get(),
    db.collection("friendRequests").where("toUid", "==", uid).where("status", "==", "pending").limit(50).get(),
    db.collection("friendRequests").where("fromUid", "==", uid).where("status", "==", "pending").limit(50).get(),
    db.collection(`users/${uid}/blocks`).limit(100).get()
  ]);
  const allUids = [];
  friendships.docs.forEach((item) => allUids.push(...(item.data().participants || [])));
  received.docs.forEach((item) => allUids.push(item.data().fromUid));
  sent.docs.forEach((item) => allUids.push(item.data().toUid));
  blocks.docs.forEach((item) => allUids.push(item.id));
  const profiles = await profilesFor(db, allUids.filter((item) => item !== uid));
  const mapRequest = (item, otherUid) => ({ id: item.id, ...item.data(), profile: profiles.get(otherUid) || { uid: otherUid } });
  return {
    friends: friendships.docs.filter((item) => item.data().status === "accepted").map((item) => {
      const otherUid = (item.data().participants || []).find((participant) => participant !== uid);
      return { friendshipId: item.id, since: item.data().acceptedAt, profile: profiles.get(otherUid) || { uid: otherUid } };
    }),
    received: received.docs.map((item) => mapRequest(item, item.data().fromUid)),
    sent: sent.docs.map((item) => mapRequest(item, item.data().toUid)),
    blocked: blocks.docs.map((item) => ({ uid: item.id, profile: profiles.get(item.id) || { uid: item.id } }))
  };
}

async function actOnFriendRequest(uid, requestId, action) {
  const allowed = new Set(["accept", "decline", "cancel"]);
  if (!allowed.has(action)) throw new SocialError("invalid_request_action", "Unsupported friend-request action.");
  const db = socialFirestore();
  const requestRef = db.doc(`friendRequests/${cleanString(requestId, 300)}`);
  return db.runTransaction(async (transaction) => {
    const request = await transaction.get(requestRef);
    if (!request.exists || request.data()?.status !== "pending") throw new SocialError("request_unavailable", "This friend request is no longer available.", 404);
    const data = request.data();
    if (action === "cancel" && data.fromUid !== uid) throw new SocialError("forbidden", "Only the sender can cancel this request.", 403);
    if ((action === "accept" || action === "decline") && data.toUid !== uid) throw new SocialError("forbidden", "Only the recipient can respond to this request.", 403);
    if (action === "accept") {
      await assertNotBlocked(transaction, db, data.fromUid, data.toUid);
      const friendshipRef = db.doc(`friendships/${pairKey(data.fromUid, data.toUid)}`);
      transaction.set(friendshipRef, {
        participants: [data.fromUid, data.toUid].sort(),
        status: "accepted",
        schemaVersion: 1,
        acceptedAt: timestampNow(),
        updatedAt: timestampNow()
      });
    }
    transaction.update(requestRef, {
      status: action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled",
      respondedBy: uid,
      respondedAt: timestampNow(),
      updatedAt: timestampNow()
    });
    return { requestId: request.id, status: action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled" };
  });
}

async function removeFriend(uid, friendUid) {
  const db = socialFirestore();
  const friendshipRef = db.doc(`friendships/${pairKey(uid, friendUid)}`);
  await db.runTransaction(async (transaction) => {
    const friendship = await transaction.get(friendshipRef);
    if (!friendship.exists || !(friendship.data()?.participants || []).includes(uid)) throw new SocialError("friendship_not_found", "Friendship not found.", 404);
    transaction.delete(friendshipRef);
  });
  return { removed: true };
}

async function blockUser(uid, targetUid) {
  if (uid === targetUid) throw new SocialError("self_block", "You cannot block yourself.");
  const db = socialFirestore();
  const key = pairKey(uid, targetUid);
  await db.runTransaction(async (transaction) => {
    const friendshipRef = db.doc(`friendships/${key}`);
    const requestRef = db.doc(`friendRequests/${key}`);
    const friendship = await transaction.get(friendshipRef);
    const request = await transaction.get(requestRef);
    transaction.set(db.doc(`users/${uid}/blocks/${targetUid}`), { blockedUid: targetUid, createdAt: timestampNow(), schemaVersion: 1 });
    if (friendship.exists) transaction.delete(friendshipRef);
    if (request.exists && request.data()?.status === "pending") transaction.update(requestRef, { status: "cancelled", respondedBy: uid, respondedAt: timestampNow(), updatedAt: timestampNow() });
    transaction.set(db.doc(`conversations/${key}`), { status: "blocked", updatedAt: timestampNow() }, { merge: true });
  });
  return { blocked: true };
}

async function unblockUser(uid, targetUid) {
  await socialFirestore().doc(`users/${uid}/blocks/${targetUid}`).delete();
  return { blocked: false };
}

async function assertAcceptedFriends(transaction, db, uid, friendUid) {
  const friendship = await transaction.get(db.doc(`friendships/${pairKey(uid, friendUid)}`));
  if (!friendship.exists || friendship.data()?.status !== "accepted") throw new SocialError("friends_only", "Only accepted friends can use this conversation.", 403);
  await assertNotBlocked(transaction, db, uid, friendUid);
}

async function openConversation(uid, friendUid) {
  const db = socialFirestore();
  const conversationId = pairKey(uid, friendUid);
  const ref = db.doc(`conversations/${conversationId}`);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    await assertAcceptedFriends(transaction, db, uid, friendUid);
    const participants = [uid, friendUid].sort();
    if (current.exists && JSON.stringify(current.data()?.participants || []) !== JSON.stringify(participants)) {
      throw new SocialError("conversation_conflict", "Conversation participants could not be verified.", 409);
    }
    transaction.set(ref, {
      participants,
      participantKey: conversationId,
      status: "active",
      schemaVersion: 1,
      updatedAt: timestampNow(),
      ...(current.exists ? {} : { createdAt: timestampNow() })
    }, { merge: true });
    for (const participant of participants) {
      transaction.set(db.doc(`users/${participant}/conversationSummaries/${conversationId}`), {
        conversationId,
        otherUid: participant === uid ? friendUid : uid,
        status: "active",
        unreadCount: 0,
        updatedAt: timestampNow()
      }, { merge: true });
    }
  });
  return getConversation(uid, conversationId);
}

async function getConversation(uid, conversationId) {
  const db = socialFirestore();
  const snapshot = await db.doc(`conversations/${cleanString(conversationId, 300)}`).get();
  if (!snapshot.exists || !(snapshot.data()?.participants || []).includes(uid)) throw new SocialError("conversation_not_found", "Conversation not found.", 404);
  const otherUid = snapshot.data().participants.find((participant) => participant !== uid);
  await assertAcceptedFriendsRead(db, uid, otherUid);
  const profile = (await profilesFor(db, [otherUid])).get(otherUid) || { uid: otherUid };
  return { id: snapshot.id, ...snapshot.data(), profile };
}

async function assertAcceptedFriendsRead(db, uid, friendUid) {
  if (!friendUid) throw new SocialError("conversation_not_found", "Conversation not found.", 404);
  const [friendship, firstBlock, secondBlock] = await Promise.all([
    db.doc(`friendships/${pairKey(uid, friendUid)}`).get(),
    db.doc(`users/${uid}/blocks/${friendUid}`).get(),
    db.doc(`users/${friendUid}/blocks/${uid}`).get()
  ]);
  if (!friendship.exists || friendship.data()?.status !== "accepted" || firstBlock.exists || secondBlock.exists) {
    throw new SocialError("conversation_not_found", "Conversation not found.", 404);
  }
}

async function listConversations(uid) {
  const db = socialFirestore();
  const snapshot = await db.collection(`users/${uid}/conversationSummaries`).orderBy("updatedAt", "desc").limit(50).get();
  const visibleDocs = [];
  for (const item of snapshot.docs) {
    const otherUid = item.data()?.otherUid;
    try {
      await assertAcceptedFriendsRead(db, uid, otherUid);
      visibleDocs.push(item);
    } catch (error) {
      if (!(error instanceof SocialError) || error.code !== "conversation_not_found") throw error;
    }
  }
  const profiles = await profilesFor(db, visibleDocs.map((item) => item.data().otherUid));
  return visibleDocs.map((item) => ({ id: item.id, ...item.data(), profile: profiles.get(item.data().otherUid) || { uid: item.data().otherUid } }));
}

async function listMessages(uid, conversationId, cursor) {
  const db = socialFirestore();
  const conversation = await db.doc(`conversations/${cleanString(conversationId, 300)}`).get();
  if (!conversation.exists || !(conversation.data()?.participants || []).includes(uid)) throw new SocialError("conversation_not_found", "Conversation not found.", 404);
  await assertAcceptedFriendsRead(db, uid, conversation.data().participants.find((participant) => participant !== uid));
  let query = db.collection(`conversations/${conversation.id}/messages`).orderBy("createdAt", "desc");
  const cursorMs = Number(cursor);
  if (Number.isFinite(cursorMs) && cursorMs > 0) query = query.startAfter(Timestamp.fromMillis(cursorMs));
  const snapshot = await query.limit(25).get();
  return {
    messages: snapshot.docs.map(documentData).reverse(),
    nextCursor: snapshot.size === 25 ? snapshot.docs.at(-1).data()?.createdAt?.toMillis?.() || null : null
  };
}

function messagePreview(message) {
  if (message.type === "artifact") return `Shared ${String(message.artifactType || "item").replaceAll("_", " ")}`;
  if (message.deletedAt) return "Message deleted";
  return cleanString(message.text, 120);
}

async function writeMessageTransaction(db, transaction, { uid, conversation, messageRef, message }) {
  const participants = conversation.data()?.participants || [];
  if (!participants.includes(uid) || participants.length !== 2) throw new SocialError("forbidden", "You cannot send to this conversation.", 403);
  const recipientUid = participants.find((participant) => participant !== uid);
  await assertAcceptedFriends(transaction, db, uid, recipientUid);
  const duplicate = await transaction.get(messageRef);
  if (duplicate.exists) return { duplicate: true, message: documentData(duplicate) };
  transaction.create(messageRef, message);
  transaction.update(conversation.ref, {
    lastMessagePreview: messagePreview(message),
    lastMessageSenderUid: uid,
    lastMessageAt: timestampNow(),
    updatedAt: timestampNow()
  });
  transaction.set(db.doc(`users/${uid}/conversationSummaries/${conversation.id}`), {
    conversationId: conversation.id,
    otherUid: recipientUid,
    lastMessagePreview: messagePreview(message),
    lastMessageSenderUid: uid,
    lastMessageAt: timestampNow(),
    unreadCount: 0,
    status: "active",
    updatedAt: timestampNow()
  }, { merge: true });
  transaction.set(db.doc(`users/${recipientUid}/conversationSummaries/${conversation.id}`), {
    conversationId: conversation.id,
    otherUid: uid,
    lastMessagePreview: messagePreview(message),
    lastMessageSenderUid: uid,
    lastMessageAt: timestampNow(),
    unreadCount: FieldValue.increment(1),
    status: "active",
    updatedAt: timestampNow()
  }, { merge: true });
  return { duplicate: false, message: { id: messageRef.id, ...message } };
}

async function sendMessage(uid, conversationId, input = {}) {
  const db = socialFirestore();
  const text = sanitizeMessage(input.text);
  const messageId = stableMessageId(uid, input.clientId);
  const conversationRef = db.doc(`conversations/${cleanString(conversationId, 300)}`);
  const messageRef = conversationRef.collection("messages").doc(messageId);
  return db.runTransaction(async (transaction) => {
    const conversation = await transaction.get(conversationRef);
    if (!conversation.exists) throw new SocialError("conversation_not_found", "Conversation not found.", 404);
    return writeMessageTransaction(db, transaction, {
      uid,
      conversation,
      messageRef,
      message: { type: "text", text, senderUid: uid, schemaVersion: 1, createdAt: Timestamp.now() }
    });
  });
}

async function deleteMessage(uid, conversationId, messageId) {
  const db = socialFirestore();
  const ref = db.doc(`conversations/${cleanString(conversationId, 300)}/messages/${cleanString(messageId, 100)}`);
  await db.runTransaction(async (transaction) => {
    const message = await transaction.get(ref);
    if (!message.exists) throw new SocialError("message_not_found", "Message not found.", 404);
    if (message.data()?.senderUid !== uid) throw new SocialError("forbidden", "You can only delete your own messages.", 403);
    transaction.update(ref, { text: "", deletedAt: timestampNow(), deletedBy: uid });
  });
  return { deleted: true };
}

async function markConversationRead(uid, conversationId) {
  const db = socialFirestore();
  const conversation = await db.doc(`conversations/${cleanString(conversationId, 300)}`).get();
  if (!conversation.exists || !(conversation.data()?.participants || []).includes(uid)) throw new SocialError("conversation_not_found", "Conversation not found.", 404);
  await assertAcceptedFriendsRead(db, uid, conversation.data().participants.find((participant) => participant !== uid));
  await db.doc(`users/${uid}/conversationSummaries/${conversation.id}`).set({ unreadCount: 0, lastReadAt: timestampNow() }, { merge: true });
  return { read: true };
}

function isoDate(value) {
  if (value?.toDate) return value.toDate().toISOString();
  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function listShareSources(uid, type) {
  const db = socialFirestore();
  const mapPlan = (item) => ({ id: item.id, title: cleanString(item.data().name || item.data().plan?.programName || item.data().plan?.planName, 80) });
  if (type === "workout") {
    const snapshot = await db.collection(`users/${uid}/workoutPlans`).orderBy("createdAt", "desc").limit(20).get();
    return snapshot.docs.map(mapPlan);
  }
  if (type === "nutrition") {
    const snapshot = await db.collection(`users/${uid}/nutritionPlans`).orderBy("createdAt", "desc").limit(20).get();
    return snapshot.docs.map(mapPlan);
  }
  if (type === "completed_workout" || type === "personal_record") {
    const snapshot = await db.collection(`users/${uid}/workoutLogs`).orderBy("completedAt", "desc").limit(50).get();
    if (type === "completed_workout") return snapshot.docs.map((item) => ({
      id: item.id,
      title: cleanString(item.data().workoutPlanName || item.data().sessionName, 80),
      completedAt: isoDate(item.data().completedAt),
      completedSets: Number(item.data().completedSets || 0)
    }));
    const records = new Map();
    for (const log of snapshot.docs) {
      for (const exercise of Array.isArray(log.data().exercises) ? log.data().exercises : []) {
        for (const set of Array.isArray(exercise.sets) ? exercise.sets : []) {
          if (set.completed === false) continue;
          const score = Number(set.weightKg || 0) * Math.max(1, Number(set.reps || 1));
          const key = cleanString(exercise.exerciseId || exercise.name, 100).toLowerCase();
          if (!key || score <= Number(records.get(key)?.score || -1)) continue;
          records.set(key, {
            id: `${log.id}:${encodeURIComponent(key)}`,
            sourceId: log.id,
            exerciseKey: key,
            title: cleanString(exercise.name, 100),
            value: Number(set.weightKg || 0),
            repetitions: Number(set.reps || 0),
            unit: "kg",
            achievedDate: isoDate(log.data().completedAt),
            score
          });
        }
      }
    }
    return [...records.values()].map(({ score, ...record }) => record).slice(0, 50);
  }
  if (["weight_progress", "progress_graph"].includes(type)) {
    if (type === "weight_progress") return [
      { id: "body-weight", title: "Body-weight trend", graphType: "body_weight" },
      { id: "weight-change", title: "Weight change", graphType: "weight_change" }
    ];
    const logs = await db.collection(`users/${uid}/workoutLogs`).orderBy("completedAt", "desc").limit(100).get();
    const exerciseKeys = new Map();
    for (const log of logs.docs) {
      for (const exercise of Array.isArray(log.data().exercises) ? log.data().exercises : []) {
        const key = cleanString(exercise.exerciseId || exercise.name, 100).toLowerCase();
        if (key && !exerciseKeys.has(key)) exerciseKeys.set(key, cleanString(exercise.name, 100));
      }
    }
    return [
      { id: "workout-consistency", title: "Completed workouts per week", graphType: "workout_consistency" },
      { id: "training-volume", title: "Training-volume trend", graphType: "training_volume" },
      ...[...exerciseKeys.entries()].slice(0, 30).map(([key, title]) => ({ id: `strength:${encodeURIComponent(key)}`, title: `${title} strength progression`, graphType: "strength_progression" }))
    ];
  }
  throw new SocialError("unsupported_artifact", "This share type is not supported.");
}

async function graphFromSource(db, uid, input) {
  const sourceId = cleanString(input.sourceId, 80);
  if (sourceId === "body-weight" || sourceId === "weight-change") {
    const snapshot = await db.collection(`users/${uid}/weightEntries`).orderBy("date", "desc").limit(60).get();
    const rawPoints = snapshot.docs.map((item) => ({
      date: cleanString(item.data().date, 24),
      value: Number(item.data().weight)
    })).filter((point) => point.date && Number.isFinite(point.value)).reverse();
    const baseline = rawPoints[0]?.value || 0;
    return {
      graphType: sourceId === "weight-change" ? "weight_change" : "body_weight",
      title: sourceId === "weight-change" ? "Weight change" : "Body-weight trend",
      unit: "kg",
      privacyMode: input.privacyMode,
      points: sourceId === "weight-change"
        ? rawPoints.map((point) => ({ ...point, value: point.value - baseline }))
        : rawPoints
    };
  }
  if (sourceId === "workout-consistency") {
    const snapshot = await db.collection(`users/${uid}/workoutLogs`).orderBy("completedAt", "desc").limit(100).get();
    const weeks = new Map();
    for (const item of snapshot.docs) {
      const date = item.data().completedAt?.toDate?.();
      if (!date) continue;
      const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      weeks.set(key, (weeks.get(key) || 0) + 1);
    }
    return {
      graphType: "workout_consistency",
      title: "Completed workouts per week",
      unit: "workouts",
      privacyMode: input.privacyMode || "exact_values",
      points: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-26).map(([date, value]) => ({ date, value }))
    };
  }
  if (sourceId === "training-volume") {
    const snapshot = await db.collection(`users/${uid}/workoutLogs`).orderBy("completedAt", "desc").limit(100).get();
    const weeks = new Map();
    for (const item of snapshot.docs) {
      const date = item.data().completedAt?.toDate?.();
      if (!date) continue;
      const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const volume = (item.data().exercises || []).flatMap((exercise) => exercise.sets || []).filter((set) => set.completed !== false).reduce((sum, set) => sum + Number(set.weightKg || 0) * Number(set.reps || 0), 0);
      weeks.set(key, (weeks.get(key) || 0) + volume);
    }
    return { graphType: "training_volume", title: "Training-volume trend", unit: "kg reps", privacyMode: input.privacyMode, points: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-26).map(([date, value]) => ({ date, value })) };
  }
  if (sourceId.startsWith("strength:")) {
    const exerciseKey = decodeURIComponent(sourceId.slice("strength:".length)).toLowerCase();
    const snapshot = await db.collection(`users/${uid}/workoutLogs`).orderBy("completedAt", "desc").limit(100).get();
    const points = [];
    let title = "Strength progression";
    for (const item of snapshot.docs) {
      const exercise = (item.data().exercises || []).find((entry) => cleanString(entry.exerciseId || entry.name, 100).toLowerCase() === exerciseKey);
      if (!exercise) continue;
      title = `${cleanString(exercise.name, 100)} strength progression`;
      const values = (exercise.sets || []).filter((set) => set.completed !== false).map((set) => Number(set.weightKg || 0)).filter(Number.isFinite);
      if (!values.length) continue;
      points.push({ date: isoDate(item.data().completedAt).slice(0, 10), value: Math.max(...values) });
    }
    return { graphType: "strength_progression", title, unit: "kg", privacyMode: input.privacyMode, points: points.reverse() };
  }
  throw new SocialError("source_not_found", "Progress data source not found.", 404);
}

async function artifactSnapshot(db, uid, profile, input) {
  const type = cleanString(input.type, 40);
  const sourceId = cleanString(input.sourceId, 180);
  if (type === "workout" || type === "nutrition") {
    const collectionName = type === "workout" ? "workoutPlans" : "nutritionPlans";
    const source = await db.doc(`users/${uid}/${collectionName}/${sourceId}`).get();
    if (!source.exists) throw new SocialError("source_not_found", "The selected plan was not found.", 404);
    return type === "workout"
      ? sanitizeWorkoutSnapshot(source.data(), profile.username)
      : sanitizeNutritionSnapshot(source.data(), profile.username);
  }
  if (type === "completed_workout" || type === "personal_record") {
    const logId = type === "personal_record" ? sourceId.split(":")[0] : sourceId;
    const source = await db.doc(`users/${uid}/workoutLogs/${logId}`).get();
    if (!source.exists) throw new SocialError("source_not_found", "The selected workout was not found.", 404);
    const log = { ...source.data(), completedAt: isoDate(source.data().completedAt) };
    if (type === "completed_workout") return sanitizeCompletedWorkoutSnapshot(log, profile.username);
    const exerciseKey = decodeURIComponent(sourceId.slice(sourceId.indexOf(":") + 1)).toLowerCase();
    const exercise = (log.exercises || []).find((item) => cleanString(item.exerciseId || item.name, 100).toLowerCase() === exerciseKey);
    if (!exercise) throw new SocialError("source_not_found", "The selected record was not found.", 404);
    const best = (exercise.sets || []).filter((set) => set.completed !== false).sort((a, b) => Number(b.weightKg || 0) * Math.max(1, Number(b.reps || 1)) - Number(a.weightKg || 0) * Math.max(1, Number(a.reps || 1)))[0];
    return sanitizeRecordSnapshot({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.name,
      value: best?.weightKg || 0,
      repetitions: best?.reps || 0,
      unit: "kg",
      achievedDate: log.completedAt,
      note: input.note
    }, profile.username);
  }
  if (type === "progress_graph" || type === "weight_progress") {
    return sanitizeGraphSnapshot(await graphFromSource(db, uid, input), profile.username);
  }
  throw new SocialError("unsupported_artifact", "This share type is not supported.");
}

async function shareArtifact(uid, conversationId, input = {}) {
  const db = socialFirestore();
  const profile = await getIdentity(uid);
  if (!profile) throw new SocialError("username_required", "Choose a username before sharing.", 409);
  const snapshot = await artifactSnapshot(db, uid, profile, input);
  const type = cleanString(input.type, 40);
  const bytes = assertArtifactSize(type, snapshot);
  const conversationRef = db.doc(`conversations/${cleanString(conversationId, 300)}`);
  const artifactRef = db.collection("sharedArtifacts").doc();
  const messageRef = conversationRef.collection("messages").doc(stableMessageId(uid, input.clientId));
  return db.runTransaction(async (transaction) => {
    const conversation = await transaction.get(conversationRef);
    if (!conversation.exists) throw new SocialError("conversation_not_found", "Conversation not found.", 404);
    const participants = conversation.data()?.participants || [];
    const recipientUid = participants.find((participant) => participant !== uid);
    if (!recipientUid) throw new SocialError("forbidden", "Artifact recipient could not be verified.", 403);
    const artifact = {
      ownerUid: uid,
      recipientIds: [recipientUid],
      conversationId: conversation.id,
      type,
      schemaVersion: 1,
      sourceId: cleanString(input.sourceId, 180),
      snapshot,
      metadata: { byteSize: bytes, creatorUsername: profile.username },
      createdAt: timestampNow(),
      revokedAt: null
    };
    const result = await writeMessageTransaction(db, transaction, {
      uid,
      conversation,
      messageRef,
      message: {
        type: "artifact",
        artifactId: artifactRef.id,
        artifactType: type,
        artifactTitle: cleanString(snapshot.title || snapshot.exerciseName, 100),
        senderUid: uid,
        schemaVersion: 1,
        createdAt: Timestamp.now()
      }
    });
    if (result.duplicate) {
      return { artifactId: result.message?.artifactId || artifactRef.id, ...result };
    }
    transaction.create(artifactRef, artifact);
    return { artifactId: artifactRef.id, ...result };
  });
}

async function getArtifact(uid, artifactId) {
  const db = socialFirestore();
  const snapshot = await db.doc(`sharedArtifacts/${cleanString(artifactId, 180)}`).get();
  if (!snapshot.exists) throw new SocialError("artifact_not_found", "Shared item not found.", 404);
  const artifact = snapshot.data();
  if (artifact.ownerUid !== uid && !(artifact.recipientIds || []).includes(uid)) throw new SocialError("forbidden", "You cannot open this shared item.", 403);
  if (artifact.revokedAt) {
    return { id: snapshot.id, ...artifact, snapshot: null, unavailable: true, compatibilityWarnings: [] };
  }
  const compatibilityWarnings = [];
  if (artifact.ownerUid !== uid && ["workout", "nutrition"].includes(artifact.type)) {
    const [athleteCore, settings] = await Promise.all([
      db.doc(`users/${uid}/athleteCore/main`).get(),
      db.doc(`users/${uid}/settings/main`).get()
    ]);
    const own = { ...(settings.data() || {}), ...(athleteCore.data() || {}) };
    if (artifact.type === "workout") {
      const ownEquipment = Array.isArray(own.equipment) ? own.equipment : Array.isArray(own.availableEquipment) ? own.availableEquipment : [];
      const available = ownEquipment.map((item) => normalizeEquipment(cleanString(item, 60)));
      const required = (artifact.snapshot?.equipment || []).map((item) => cleanString(item, 60)).filter(Boolean);
      if (available.length) {
        const missing = required.filter((item) => !available.includes(normalizeEquipment(item)));
        if (missing.length) compatibilityWarnings.push(`Equipment not in your saved setup: ${missing.slice(0, 8).join(", ")}.`);
      }
    } else {
      const restrictions = [
        ...(Array.isArray(own.allergies) ? own.allergies : []),
        ...(Array.isArray(own.dietaryRestrictions) ? own.dietaryRestrictions : []),
        ...(Array.isArray(own.avoidedFoods) ? own.avoidedFoods : [])
      ].map((item) => cleanString(item, 60)).filter(Boolean);
      const foodText = (artifact.snapshot?.meals || []).flatMap((meal) => meal.foods || []).map((food) => cleanString(food.name, 100).toLowerCase()).join(" ");
      const conflicts = restrictions.filter((restriction) => foodText.includes(restriction.toLowerCase()));
      if (conflicts.length) compatibilityWarnings.push(`This plan may conflict with your saved dietary preferences: ${conflicts.slice(0, 8).join(", ")}.`);
    }
  }
  return { id: snapshot.id, ...artifact, unavailable: false, compatibilityWarnings };
}

async function revokeArtifact(uid, artifactId) {
  const db = socialFirestore();
  const ref = db.doc(`sharedArtifacts/${cleanString(artifactId, 180)}`);
  await db.runTransaction(async (transaction) => {
    const artifact = await transaction.get(ref);
    if (!artifact.exists) throw new SocialError("artifact_not_found", "Shared item not found.", 404);
    if (artifact.data()?.ownerUid !== uid) throw new SocialError("forbidden", "Only the owner can revoke this shared item.", 403);
    transaction.update(ref, { revokedAt: timestampNow(), revokedBy: uid });
  });
  return { revoked: true };
}

async function copyArtifact(uid, artifactId) {
  const db = socialFirestore();
  const artifactRef = db.doc(`sharedArtifacts/${cleanString(artifactId, 180)}`);
  const importRef = db.doc(`users/${uid}/sharedImports/${artifactRef.id}`);
  return db.runTransaction(async (transaction) => {
    const artifact = await transaction.get(artifactRef);
    const previousImport = await transaction.get(importRef);
    if (!artifact.exists) throw new SocialError("artifact_not_found", "Shared item not found.", 404);
    const data = artifact.data();
    if (!(data.recipientIds || []).includes(uid)) throw new SocialError("forbidden", "Only the recipient can copy this item.", 403);
    if (data.revokedAt) throw new SocialError("artifact_revoked", "This shared item is no longer available.", 410);
    if (previousImport.exists) return { duplicate: true, ...previousImport.data() };
    const attribution = `Copied from @${cleanString(data.metadata?.creatorUsername || data.snapshot?.creatorUsername, 20)}`;
    let collectionName;
    let copy;
    if (data.type === "workout") {
      collectionName = "workoutPlans";
      copy = buildWorkoutCopy(data.snapshot, attribution, artifact.id);
    } else if (data.type === "nutrition") {
      collectionName = "nutritionPlans";
      copy = buildNutritionCopy(data.snapshot, attribution, artifact.id);
    } else {
      throw new SocialError("copy_not_supported", "This shared item is view-only.", 409);
    }
    const copyRef = db.collection(`users/${uid}/${collectionName}`).doc();
    transaction.create(copyRef, { ...copy, createdAt: timestampNow(), updatedAt: timestampNow() });
    transaction.create(importRef, {
      artifactId: artifact.id,
      copyId: copyRef.id,
      collection: collectionName,
      sourceOwnerUid: data.ownerUid,
      copiedAt: timestampNow()
    });
    return { duplicate: false, copyId: copyRef.id, collection: collectionName, attribution };
  });
}

module.exports = {
  actOnFriendRequest,
  blockUser,
  copyArtifact,
  deleteMessage,
  getArtifact,
  getConversation,
  getIdentity,
  getPublicProfile,
  listConversations,
  listMessages,
  listRelationships,
  listShareSources,
  markConversationRead,
  openConversation,
  removeFriend,
  reserveUsername,
  revokeArtifact,
  searchUsers,
  sendFriendRequest,
  sendMessage,
  setTrustedBadges,
  shareArtifact,
  updatePublicProfile,
  socialFirestore,
  unblockUser
};
