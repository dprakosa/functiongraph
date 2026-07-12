import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-hairline bg-white p-3 shadow-xs">
      <p className="m-0 text-[11px] font-medium text-muted">{label}</p>
      <p className="text-metric m-0 mt-1 text-xl font-semibold tracking-tight text-ink">
        {value}
      </p>
      {detail && <p className="m-0 mt-0.5 text-[11px] text-muted">{detail}</p>}
    </div>
  );
}
