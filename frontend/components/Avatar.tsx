"use client";

import { API } from "@/lib/api";
import { avatarEmoji } from "@/lib/avatar";

const SIZE = {
  sm: "size-7 text-sm",
  md: "size-9 text-lg",
  lg: "size-14 text-3xl",
  xl: "size-20 text-4xl",
} as const;

function resolveSrc(src?: string | null) {
  if (!src) return null;
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src;
  if (src.startsWith("/zk-api/")) return src;
  return `${API}${src.startsWith("/") ? src : `/${src}`}`;
}

export function Avatar({
  seed,
  src,
  emoji,
  size = "md",
  className = "",
}: {
  seed: string;
  /** Uploaded photo path from API (`/avatars/…`) or absolute URL. */
  src?: string | null;
  /** Chosen emoji; falls back to hash of seed. */
  emoji?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const href = resolveSrc(src);
  if (href) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dynamic user uploads; no next/image remote config
      <img
        src={href}
        alt=""
        className={`inline-block shrink-0 rounded-full border border-cream/15 object-cover ${SIZE[size]} ${className}`}
        title={seed}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-cream/15 bg-gradient-to-br from-ink to-teal/30 ${SIZE[size]} ${className}`}
      aria-hidden
      title={seed}
    >
      {emoji || avatarEmoji(seed)}
    </span>
  );
}
