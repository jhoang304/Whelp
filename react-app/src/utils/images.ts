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
