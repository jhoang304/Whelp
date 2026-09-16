import { parseErrors } from "./parseErrors";

export interface UploadResult {
  url?: string;
  errors?: string[];
}

export const MAX_UPLOAD_MB = 5;
export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp";

/**
 * Upload one image file to S3 through the backend and get back its public URL.
 * The returned URL is then saved through the normal JSON routes
 * (restaurant images, profile picture, ...).
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return { errors: [`Images must be smaller than ${MAX_UPLOAD_MB} MB.`] };
  }

  const body = new FormData();
  body.append("image", file);

  try {
    // No Content-Type header: the browser sets the multipart boundary itself.
    const response = await fetch("/api/images/upload", { method: "POST", body });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data.url) return { url: data.url };
    }
    return { errors: await parseErrors(response, "Image upload failed. Please try again.") };
  } catch (err) {
    return { errors: ["Network error while uploading the image. Please try again."] };
  }
}
