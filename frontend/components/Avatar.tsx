"use client";

import { avatarEmoji } from "@/lib/avatar";

const SIZE = {
  sm: "size-7 text-sm",
  md: "size-9 text-lg",
  lg: "size-14 text-3xl",
  xl: "size-20 text-4xl",
} as const;

export function Avatar({
  seed,
  size = "md",
  className = "",
}: {
  seed: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-cream/15 bg-gradient-to-br from-ink to-teal/30 ${SIZE[size]} ${className}`}
      aria-hidden
      title={seed}
    >
      {avatarEmoji(seed)}
    </span>
  );
}
