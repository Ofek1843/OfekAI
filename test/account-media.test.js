const test = require("node:test");
const assert = require("node:assert/strict");
const { mediaReferencesFromDocuments } = require("../lib/account-media");

test("media extractor finds all real nested progress-photo angles without trusting them as ownership proof", () => {
  const result = mediaReferencesFromDocuments([{
    photos: {
      front: { provider: "imagekit", fileId: "front_123456", path: "/fuelphysique/users/user-a/progressPhotos/front" },
      side: { provider: "imagekit", fileId: "side_123456", path: "/fuelphysique/users/user-a/progressPhotos/side" },
      back: { provider: "imagekit", fileId: "back_123456", path: "/fuelphysique/users/user-a/progressPhotos/back" }
    },
    legacy: { storagePath: "users/user-a/transformationSubmissions/before.jpg" }
  }]);
  assert.deepEqual(result.imageKitFileIds.sort(), ["back_123456", "front_123456", "side_123456"]);
  assert.deepEqual(result.storagePaths.sort(), ["/fuelphysique/users/user-a/progressPhotos/back", "/fuelphysique/users/user-a/progressPhotos/front", "/fuelphysique/users/user-a/progressPhotos/side", "users/user-a/transformationSubmissions/before.jpg"]);
});

test("media extractor ignores malformed IDs and traversal-like storage paths", () => {
  const result = mediaReferencesFromDocuments([{ fileId: "bad id", storagePath: "users/user-a/../user-b/photo.jpg", nested: { afterFileId: "valid_123456" } }]);
  assert.deepEqual(result.imageKitFileIds, ["valid_123456"]);
  assert.deepEqual(result.storagePaths, []);
});
