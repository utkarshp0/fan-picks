import { cn } from "@/lib/utils";

type FanPicksMarkProps = {
  className?: string;
  label?: string;
};

export function FanPicksMark({
  className,
  label = "Fan Picks",
}: FanPicksMarkProps) {
  return (
    <svg
      aria-label={label}
      className={cn("h-6 w-6", className)}
      role="img"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="64" rx="14" width="64" fill="#18c37e" />
      <path
        d="M19 18.5C19 16.57 20.57 15 22.5 15H43C44.93 15 46.5 16.57 46.5 18.5V42C46.5 43.93 44.93 45.5 43 45.5H22.5C20.57 45.5 19 43.93 19 42V18.5Z"
        fill="#07110d"
      />
      <path
        d="M25 24.5H39.5M25 31H33.25"
        stroke="#f8fafc"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M28 39.25L32.1 43.25L40.75 34"
        stroke="#18c37e"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.8"
      />
      <circle cx="18" cy="18" fill="#f8fafc" r="3.2" />
      <circle cx="46.5" cy="17" fill="#f8fafc" r="2.6" />
      <circle cx="49" cy="45.5" fill="#f8fafc" r="3" />
      <circle cx="16" cy="45" fill="#f8fafc" r="2.5" />
    </svg>
  );
}
