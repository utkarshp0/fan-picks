type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeading({
  description,
  eyebrow,
  title,
}: SectionHeadingProps) {
  return (
    <div className="space-y-1">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-xl font-semibold leading-7 text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p>
      ) : null}
    </div>
  );
}
