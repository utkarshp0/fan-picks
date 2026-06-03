import { LoaderCircle } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:outline-accent",
  secondary:
    "border border-border bg-surface-raised text-foreground hover:bg-surface focus-visible:outline-muted",
  ghost:
    "text-muted hover:bg-surface-raised hover:text-foreground focus-visible:outline-muted",
};

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  loading?: boolean;
  loadingLabel?: ReactNode;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className,
  disabled,
  loading = false,
  loadingLabel,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        loading &&
          "before:absolute before:inset-0 before:translate-x-[-120%] before:animate-[button-shine_1.25s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent",
        variantClassName[variant],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={type}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
