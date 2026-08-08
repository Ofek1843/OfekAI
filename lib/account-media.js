"use strict";

// Extract only identifiers and storage paths from a user's own records. These
// references are never themselves treated as proof of ImageKit ownership: the
// provider metadata check in the account-deletion service is authoritative.
const FILE_ID_KEYS = new Set(["fileId", "beforeFileId", "afterFileId"]);
const STORAGE_PATH_KEYS = new Set(["path", "storagePath", "filePath", "beforePath", "afterPath"]);

function cleanFileId(value) {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9_-]{6,200}$/.test(id) ? id : "";
}

function cleanStoragePath(value) {
  const path = String(value || "").trim();
  return path && path.length <= 1000 && !path.includes("..") ? path : "";
}

function collectMediaReferences(value, result = { imageKitFileIds: new Set(), storagePaths: new Set() }, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return result;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectMediaReferences(item, result, seen));
    return result;
  }
  for (const [key, item] of Object.entries(value)) {
    if (FILE_ID_KEYS.has(key)) {
      const id = cleanFileId(item);
      if (id) result.imageKitFileIds.add(id);
      continue;
    }
    if (STORAGE_PATH_KEYS.has(key)) {
      const path = cleanStoragePath(item);
      if (path) result.storagePaths.add(path);
      continue;
    }
    collectMediaReferences(item, result, seen);
  }
  return result;
}

function mediaReferencesFromDocuments(documents = []) {
  const result = { imageKitFileIds: new Set(), storagePaths: new Set() };
  for (const document of documents) collectMediaReferences(document || {}, result);
  return {
    imageKitFileIds: [...result.imageKitFileIds],
    storagePaths: [...result.storagePaths]
  };
}

module.exports = { cleanFileId, cleanStoragePath, collectMediaReferences, mediaReferencesFromDocuments };
