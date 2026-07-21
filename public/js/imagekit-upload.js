import { auth } from "./firebase-config.js";

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication is required.");
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    "Content-Type": "application/json"
  };
}

export async function getImageKitUploadAuth() {
  const response = await fetch("/api/imagekit/upload-auth", {
    headers: await authHeaders()
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
  const auth = await getImageKitUploadAuth();
  const form = new FormData();
  form.append("file", file, fileName || file.name || "upload.bin");
  form.append("fileName", fileName || file.name || "upload.bin");
  form.append("folder", folder);
  form.append("useUniqueFileName", "false");
  form.append("isPrivateFile", String(Boolean(isPrivateFile)));
  form.append("publicKey", auth.publicKey);
  form.append("signature", auth.signature);
  form.append("token", auth.token);
  form.append("expire", String(auth.expire));
  if (tags.length) form.append("tags", JSON.stringify(tags));

  const xhr = new XMLHttpRequest();
  return await new Promise((resolve, reject) => {
    xhr.open("POST", "https://upload.imagekit.io/api/v1/files/upload");
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
