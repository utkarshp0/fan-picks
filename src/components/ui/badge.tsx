import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "warning" | "muted";

const variantClassName: Record<BadgeVariant, string> = {
  default: "border-border bg-surface-raised text-foreground",
  accent: "border-accent/40 bg-accent/12 text-accent",
  warning: "border-warning/40 bg-warning/12 text-warning",
  muted: "border-border bg-surface text-muted",
};

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-medium",
        variantClassName[variant],
        className,
      )}
      {...props}
    />
  );
}
