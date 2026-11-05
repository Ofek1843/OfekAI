import { auth } from "./firebase-config.js";

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication is required.");
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    "Content-Type": "application/json"
  };
}

export async function getImageKitUploadAuth(input) {
  const response = await fetch("/api/imagekit/upload-auth", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not prepare upload credentials.");
  return data;
}

export async function directImageKitUpload({
  file,
  fileName,
  folder,
  isPrivateFile = true,
  tags = [],
  onProgress
}) {
  const uid = auth.currentUser?.uid;
  const prefix = `/fuelphysique/users/${uid}/`;
  const normalizedFolder = String(folder || "");
  if (!uid || !normalizedFolder.startsWith(prefix)) {
    throw new Error("This upload destination is not available for your account.");
  }
  const suffix = normalizedFolder.slice(prefix.length);
  const match = /^progressPhotos\/([a-zA-Z0-9_-]{1,128})$/.exec(suffix);
  const purpose = match ? "progress" : suffix === "social-profile" ? "profile" : null;
  if (!purpose || (purpose === "progress" && !isPrivateFile)) throw new Error("Invalid photo upload.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file?.type) || file.size > 5242880) throw new Error("Photos must be JPEG, PNG or WebP and no larger than 5 MB.");
  const authorization = await getImageKitUploadAuth({ purpose, entryId: match?.[1], mimeType: file.type });
  const form = new FormData();
  form.append("file", file, fileName || file.name || "upload.bin");
  for (const [key, value] of Object.entries(authorization.uploadParams)) form.append(key, value);
  form.append("token", authorization.token);

  const xhr = new XMLHttpRequest();
  return await new Promise((resolve, reject) => {
    xhr.open("POST", "https://upload.imagekit.io/api/v2/files/upload");
    xhr.upload.onprogress = event => {
      if (typeof onProgress === "function" && event.lengthComputable) {
        onProgress({ loaded: event.loaded, total: event.total });
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(data?.message || data?.error || "Upload failed."));
          return;
        }
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(form);
  });
}
