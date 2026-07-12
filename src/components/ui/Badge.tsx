import type { ReactNode } from "react";

export type BadgeTone = "amber" | "new" | "covered" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  amber: "border-amber/25 bg-amber-soft text-amber-text",
  new: "border-new/25 bg-new-soft text-new-text",
  covered: "border-hairline bg-covered-soft text-covered-text",
  neutral: "border-hairline bg-hairline-soft text-body",
};

export function Badge({
  tone,
  icon,
  children,
  block = false,
}: {
  tone: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  block?: boolean;
}) {
  return (
    <span
      className={`${
        block ? "flex w-full" : "inline-flex"
      } items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {icon && (
        <span aria-hidden="true" className="shrink-0 leading-none">
          {icon}
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </span>
  );
}
