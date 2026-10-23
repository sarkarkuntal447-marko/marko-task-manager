import { useMemo } from "react";
import { fmtDate } from "@/lib/format";

export type GanttItem = {
  id: string;
  label: string;
  sublabel?: string;
  start: string | null; // YYYY-MM-DD
  end: string | null;   // YYYY-MM-DD
  progress?: number;    // 0-100, shown as the filled part of the bar
  done?: boolean;       // finished items are drawn green
  onClick?: () => void;
};

const DAY = 86_400_000;
const toMs = (d: string) => { const [y, m, day] = d.split("-").map(Number); return Date.UTC(y, m - 1, day); };
const monthLabel = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" });

/** Simple Gantt chart: one row per item, bars positioned by start/end date, with a "today" marker. */
export function GanttChart({ items, emptyText = "Nothing to show yet." }: { items: GanttItem[]; emptyText?: string }) {
  const { dated, undated, min, span, months } = useMemo(() => {
    const dated = items
      .filter((i) => i.start || i.end)
      .map((i) => {
        // If only one date is known, draw a one-day bar there.
        const s = toMs((i.start ?? i.end)!);
        const e = Math.max(s, toMs((i.end ?? i.start)!));
        return { ...i, s, e };
      });
    const undated = items.filter((i) => !i.start && !i.end);
    const today = new Date(); const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const all = dated.flatMap((d) => [d.s, d.e]).concat(dated.length ? [t] : []);
    const lo = Math.min(...all), hi = Math.max(...all);
    // Pad the range and snap to whole months so the scale reads cleanly.
    const first = new Date(lo); const start = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
    const last = new Date(hi); const end = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1);
    const months: { ms: number }[] = [];
    if (dated.length) for (let c = new Date(start); c.getTime() < end; c = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1))) months.push({ ms: c.getTime() });
    return { dated, undated, min: start, span: Math.max(end - start, DAY), months };
  }, [items]);

  if (!items.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  const pct = (ms: number) => ((ms - min) / span) * 100;
  const now = new Date(); const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const showToday = dated.length > 0 && todayMs >= min && todayMs <= min + span;

  return (
    <div className="space-y-3">
      {dated.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1 overscroll-x-contain">
          <div className="min-w-[520px] sm:min-w-[760px]">
            {/* month scale */}
            <div className="flex border-b border-border">
              <div className="w-32 sm:w-48 shrink-0" />
              <div className="relative flex-1 h-7">
                {months.map((m) => (
                  <div key={m.ms} className="absolute top-0 bottom-0 border-l border-border pl-1.5 text-xs text-muted-foreground flex items-center"
                    style={{ left: `${pct(m.ms)}%` }}>{monthLabel(m.ms)}</div>
                ))}
              </div>
            </div>
            {/* rows */}
            {dated.map((d) => {
              const left = pct(d.s);
              const width = Math.max(pct(d.e + DAY) - left, 1.2);
              const clickable = !!d.onClick;
              return (
                <div key={d.id} className="flex items-center border-b border-border/60 hover:bg-accent/40">
                  <div className={`w-32 sm:w-48 shrink-0 pr-2 sm:pr-3 py-2 ${clickable ? "cursor-pointer" : ""}`} onClick={d.onClick}>
                    <p className="text-sm font-medium truncate" title={d.label}>{d.label}</p>
                    {d.sublabel && <p className="text-xs text-muted-foreground truncate">{d.sublabel}</p>}
                  </div>
                  <div className="relative flex-1 h-10">
                    {months.map((m) => <div key={m.ms} className="absolute top-0 bottom-0 border-l border-border/50" style={{ left: `${pct(m.ms)}%` }} />)}
                    {showToday && <div className="absolute top-0 bottom-0 w-px bg-destructive/70 z-10" style={{ left: `${pct(todayMs)}%` }} />}
                    <div
                      className={`absolute top-2 h-6 rounded-md overflow-hidden ${d.done ? "bg-success/30" : "bg-primary/30"} ${clickable ? "cursor-pointer" : ""}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${d.label}: ${fmtDate(d.start)} → ${fmtDate(d.end)}${d.progress != null ? ` · ${d.progress}%` : ""}`}
                      onClick={d.onClick}
                    >
                      <div className={`h-full ${d.done ? "bg-success" : "bg-primary"}`} style={{ width: `${d.done ? 100 : d.progress ?? 0}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-primary" /> In progress</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-success" /> Completed</span>
        {showToday && <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-destructive" /> Today</span>}
      </div>
      {undated.length > 0 && (
        <p className="text-xs text-muted-foreground">
          No dates set (not shown on the chart): {undated.map((u) => u.label).join(", ")}
        </p>
      )}
    </div>
  );
}
