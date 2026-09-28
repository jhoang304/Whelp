import React from "react";

/**
 * Local fallback images, served from /public so they never expire the way
 * hot-linked CDN images do.
 */
export const DEFAULT_RESTAURANT_IMAGE = "/default-restaurant.svg";
export const DEFAULT_AVATAR = "/default-avatar.svg";

/** onError handler: swap a broken <img> for the given fallback exactly once. */
export const fallbackTo = (fallback: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src.endsWith(fallback)) return;
  img.src = fallback;
};

export const onRestaurantImageError = fallbackTo(DEFAULT_RESTAURANT_IMAGE);
export const onAvatarError = fallbackTo(DEFAULT_AVATAR);

export const avatarUrl = (user?: { profile_image_url?: string | null } | null): string =>
  user?.profile_image_url || DEFAULT_AVATAR;

/**
 * What the API takes as a pasted photo link: http or https, in any case, and
 * no longer than the 255-character column (RestaurantImageForm and the
 * profile form). Checked here first so a long link is a message on the form
 * rather than a round trip.
 */
export const IMAGE_URL_PATTERN = /^https?:\/\/.+/i;
export const MAX_IMAGE_URL_LENGTH = 255;

/** Why a pasted photo link won't be taken, or null. `label` names it, e.g. "Photo URL". */
export function imageUrlProblem(url: string, label: string): string | null {
  if (!IMAGE_URL_PATTERN.test(url)) return `${label} must start with http:// or https://`;
  if (url.length > MAX_IMAGE_URL_LENGTH) return `${label} must be ${MAX_IMAGE_URL_LENGTH} characters or fewer.`;
  return null;
}
