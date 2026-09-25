import { AppDispatch } from "../store";
import { attachReviewImage } from "../store/reviews";
import { uploadImage } from "./uploads";
import type { PendingPhoto } from "../components/Reviews/ReviewPhotoPicker";

/**
 * The two halves of saving photos with a review, shared by the create and
 * edit forms.
 *
 * They are split around the review itself on purpose. Uploading happens
 * first, because it is the step that realistically fails -- a file the
 * server will not take, S3 not configured, the connection dropping -- and
 * failing before the review is saved means failing before anything the reader
 * would have to undo. Attaching happens after, because it needs the review's
 * id and is a database write that the author check will pass.
 */

export interface UploadedPhoto {
    photo: PendingPhoto;
    url: string;
}

/**
 * Upload each staged photo in turn, stopping at the first one refused.
 *
 * Stopping leaves any already sent in this attempt in the bucket unattached,
 * the same trade the restaurant form makes with its cover photo: the other
 * order would mean saving a review whose photos then fail to arrive.
 */
export async function uploadPending(
    pending: PendingPhoto[],
): Promise<{ uploaded: UploadedPhoto[]; errors: string[] | null }> {
    const uploaded: UploadedPhoto[] = [];
    for (const photo of pending) {
        const result = await uploadImage(photo.file);
        if (!result.url) {
            const reasons = result.errors && result.errors.length
                ? result.errors
                : ["Image upload failed. Please try again."];
            return { uploaded, errors: reasons.map((reason) => `${photo.file.name}: ${reason}`) };
        }
        uploaded.push({ photo, url: result.url });
    }
    return { uploaded, errors: null };
}

/**
 * Attach uploaded photos to a saved review. Returns the staged photos that
 * did not make it, so a form can keep only those and let the reader retry
 * without attaching the others twice.
 */
export async function attachUploaded(
    dispatch: AppDispatch,
    reviewId: number | string,
    uploaded: UploadedPhoto[],
): Promise<{ failed: PendingPhoto[]; errors: string[] }> {
    const failed: PendingPhoto[] = [];
    const errors: string[] = [];
    for (const { photo, url } of uploaded) {
        const failures = await dispatch(attachReviewImage(reviewId, url));
        if (failures) {
            failed.push(photo);
            errors.push(...failures.map((reason) => `${photo.file.name}: ${reason}`));
        }
    }
    return { failed, errors };
}
