import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { updateProject, updateProjectPhase } from "@/lib/projects.functions";
import type { PhaseDoc, ProjectDoc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { statusLabel, fmtDate } from "@/lib/format";
import { PROJECT_TYPE_LABEL, isDelivered, projectTypeOf } from "@/lib/project-status";

// ---------- date helpers (days since epoch, UTC, so time zones never shift a date) ----------
const toDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
const toStr = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10);
const todayDay = () => {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86_400_000;
};
const dow = (day: number) => new Date(day * 86_400_000).getUTCDay(); // 0 = Sunday
const monthStart = (day: number) => {
  const d = new Date(day * 86_400_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 86_400_000;
};
const nextMonth = (day: number) => {
  const d = new Date(day * 86_400_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 86_400_000;
};
const monthName = (day: number) =>
  new Date(day * 86_400_000).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

type Zoom = "weeks" | "months" | "quarters";
const PX: Record<Zoom, number> = { weeks: 28, months: 9, quarters: 3.5 };
const LEFT = 300; // width of the name column
const ROW = 38; // row height

type Row = {
  key: string;
  kind: "project" | "phase";
  depth: number;
  label: string;
  sublabel?: string;
  start: number | null;
  end: number | null;
  progress: number;
  status: string;
  done: boolean;
  overdue: boolean;
  phaseId?: string;
  collapsibleKey?: string;
};

function colors(r: Row) {
  if (r.done) return { track: "bg-success/30", fill: "bg-success" };
  if (r.overdue || r.status === "blocked")
    return { track: "bg-destructive/30", fill: "bg-destructive" };
  if (r.status === "not_started" || r.status === "on_hold")
    return { track: "bg-muted-foreground/20", fill: "bg-muted-foreground/50" };
  return { track: "bg-primary/30", fill: "bg-primary" };
}

export function ProjectTimeline({
  project,
  phases,
  canEdit,
  onOpenPhase,
  onChanged,
}: {
  project: ProjectDoc;
  phases: PhaseDoc[];
  canEdit: boolean;
  onOpenPhase: (phaseId: string) => void;
  onChanged: () => void;
}) {
  const [zoom, setZoom] = useState<Zoom>("weeks");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, { start: number; end: number }>>({});
  const [drag, setDrag] = useState<null | {
    key: string;
    mode: "move" | "start" | "end";
    originX: number;
    s0: number;
    e0: number;
    delta: number;
  }>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const px = PX[zoom];
  const today = todayDay();

  // ---------- build rows: project > phases ----------
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const pStart = project.start_date ? toDay(project.start_date) : null;
    const pEnd = project.expected_delivery_date
      ? toDay(project.expected_delivery_date)
      : project.actual_delivery_date
        ? toDay(project.actual_delivery_date)
        : null;
    const pDone = isDelivered(project.status);
    out.push({
      key: "project",
      kind: "project",
      depth: 0,
      label: project.name,
      sublabel: `${PROJECT_TYPE_LABEL[projectTypeOf(project)]} · ${statusLabel(project.status)}`,
      start: pStart ?? pEnd,
      end: pEnd ?? pStart,
      progress: project.progress ?? 0,
      status: project.status,
      done: pDone,
      overdue: !pDone && pEnd != null && pEnd < today && project.status !== "on_hold",
      collapsibleKey: "project",
    });
    if (collapsed.has("project")) return out;
    for (const ph of phases) {
      const s = ph.start_date ? toDay(ph.start_date) : null,
        e = ph.end_date ? toDay(ph.end_date) : null;
      const done = !!ph.completed;
      out.push({
        key: `phase:${ph.id}`,
        kind: "phase",
        depth: 1,
        label: ph.name,
        sublabel: statusLabel(ph.status),
        start: s ?? e,
        end: e ?? s,
        status: ph.status,
        done,
        phaseId: ph.id,
        progress: done ? 100 : ph.status === "in_progress" ? 50 : 0,
        overdue: !done && e != null && e < today,
      });
    }
    return out;
  }, [project, phases, collapsed, today]);

  const effective = (r: Row) => {
    if (drag && drag.key === r.key) {
      const { s0, e0, delta, mode } = drag;
      if (mode === "move") return { start: s0 + delta, end: e0 + delta };
      if (mode === "start") return { start: Math.min(s0 + delta, e0), end: e0 };
      return { start: s0, end: Math.max(e0 + delta, s0) };
    }
    const o = overrides[r.key];
    return o ?? { start: r.start, end: r.end };
  };

  // ---------- visible date range ----------
  const { min, days } = useMemo(() => {
    const all: number[] = [today];
    for (const r of rows) {
      if (r.start != null) all.push(r.start);
      if (r.end != null) all.push(r.end);
    }
    let lo = Math.min(...all) - 10,
      hi = Math.max(...all) + 21;
    if (hi - lo < 42) hi = lo + 42;
    lo = zoom === "weeks" ? lo - ((dow(lo) + 6) % 7) : monthStart(lo); // start on a Monday / the 1st
    return { min: lo, days: hi - lo + 1 };
  }, [rows, zoom, today]);
  const W = days * px;
  const x = (day: number) => (day - min) * px;

  // ---------- header segments ----------
  const months = useMemo(() => {
    const out: { day: number; len: number }[] = [];
    for (let d = monthStart(min); d < min + days; d = nextMonth(d))
      out.push({ day: d, len: nextMonth(d) - d });
    return out;
  }, [min, days]);

  const goToday = () => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, LEFT + x(today) - (el.clientWidth - LEFT) / 2);
  };
  useEffect(() => {
    goToday(); /* eslint-disable-next-line */
  }, [zoom]);

  // ---------- saving ----------
  const save = useMutation({
    mutationFn: async (v: { row: Row; start: number; end: number }) => {
      if (v.row.kind === "phase") {
        await updateProjectPhase({
          data: {
            projectId: project.id,
            phaseId: v.row.phaseId!,
            changes: { start_date: toStr(v.start), end_date: toStr(v.end) },
          },
        });
      } else if (v.row.kind === "project") {
        await updateProject({
          data: {
            id: project.id,
            changes: { start_date: toStr(v.start), expected_delivery_date: toStr(v.end) },
          },
        });
      }
    },
    onSuccess: () => onChanged(),
    onError: (e: Error) => toast.error(e.message),
    onSettled: (_d, _e, v) =>
      setOverrides((o) => {
        const n = { ...o };
        delete n[v.row.key];
        return n;
      }),
  });
  const commit = (row: Row, start: number, end: number) => {
    setOverrides((o) => ({ ...o, [row.key]: { start, end } })); // show the new position immediately
    save.mutate({ row, start, end });
  };

  const spread = useMutation({
    mutationFn: async () => {
      const s = toDay(project.start_date),
        e = toDay(project.expected_delivery_date);
      const n = phases.length,
        total = e - s + 1;
      let cursor = s;
      await Promise.all(
        phases.map((ph, i) => {
          const len = Math.floor(total / n) + (i < total % n ? 1 : 0);
          const a = cursor,
            b = cursor + Math.max(len, 1) - 1;
          cursor = b + 1;
          return updateProjectPhase({
            data: {
              projectId: project.id,
              phaseId: ph.id,
              changes: { start_date: toStr(a), end_date: toStr(b) },
            },
          });
        }),
      );
    },
    onSuccess: () => {
      toast.success("Phases spread across the project dates");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------- pointer handling for drag ----------
  const startDrag = (e: React.PointerEvent, r: Row, mode: "move" | "start" | "end") => {
    if (
      !canEdit ||
      r.start == null ||
      r.end == null ||
      (r.kind !== "phase" && r.kind !== "project")
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ key: r.key, mode, originX: e.clientX, s0: r.start, e0: r.end, delta: 0 });
  };
  const moveDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!drag) return;
    setDrag({ ...drag, delta: Math.round((e.clientX - drag.originX) / px) });
  };
  const endDrag = (r: Row, e?: React.PointerEvent) => {
    e?.stopPropagation();
    if (!drag) return;
    const eff = effective(r);
    setDrag(null);
    if (drag.delta !== 0 && eff.start != null && eff.end != null) commit(r, eff.start, eff.end);
  };
  const createBar = (e: React.MouseEvent, r: Row) => {
    if (!canEdit || r.start != null || (r.kind !== "phase" && r.kind !== "project")) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const day = min + Math.floor((e.clientX - rect.left) / px);
    commit(r, day, day + (r.kind === "phase" ? 6 : 29));
  };

  const toggle = (k: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const canSpread =
    canEdit && phases.length > 0 && project.start_date && project.expected_delivery_date;

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {(["weeks", "months", "quarters"] as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`px-3 py-1.5 text-sm capitalize ${zoom === z ? "bg-primary text-primary-foreground font-medium" : "bg-card hover:bg-accent"}`}
            >
              {z}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
        {canSpread && (
          <Button
            variant="outline"
            size="sm"
            disabled={spread.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Replace every phase's dates with an even split of the project's start–delivery dates?",
                )
              )
                spread.mutate();
            }}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Spread phases evenly
          </Button>
        )}
        {canEdit && (
          <span className="text-xs text-muted-foreground ml-auto">
            Drag a bar to move it, drag its ends to resize. Click an empty row to add dates.
          </span>
        )}
      </div>

      <div
        ref={scroller}
        className="relative overflow-auto rounded-lg border border-border bg-card max-h-[70vh]"
      >
        <div style={{ width: LEFT + W }}>
          {/* header */}
          <div className="sticky top-0 z-30 flex bg-card border-b border-border">
            <div
              className="sticky left-0 z-40 bg-card border-r border-border flex items-end px-3 pb-1 text-xs font-medium text-muted-foreground"
              style={{ width: LEFT, height: zoom === "quarters" ? 30 : 52 }}
            >
              Phase
            </div>
            <div className="relative" style={{ width: W, height: zoom === "quarters" ? 30 : 52 }}>
              {months.map((m) => (
                <div
                  key={m.day}
                  className="absolute top-0 h-[30px] border-l border-border px-1.5 text-xs font-medium flex items-center overflow-hidden whitespace-nowrap"
                  style={{ left: x(m.day), width: m.len * px }}
                >
                  {monthName(m.day)}
                </div>
              ))}
              {zoom === "weeks" &&
                Array.from({ length: days }, (_, i) => {
                  const d = min + i,
                    wk = dow(d) === 0 || dow(d) === 6;
                  return (
                    <div
                      key={d}
                      className={`absolute top-[30px] h-[22px] text-[10px] text-center leading-[22px] border-l border-border/40 ${wk ? "bg-muted/60 text-muted-foreground" : ""} ${d === today ? "font-bold text-destructive" : ""}`}
                      style={{ left: i * px, width: px }}
                    >
                      {new Date(d * 86_400_000).getUTCDate()}
                    </div>
                  );
                })}
              {zoom === "months" &&
                Array.from({ length: Math.ceil(days / 7) }, (_, i) => {
                  const d = min + i * 7;
                  return (
                    <div
                      key={d}
                      className="absolute top-[30px] h-[22px] text-[10px] leading-[22px] pl-1 border-l border-border/40 text-muted-foreground"
                      style={{ left: i * 7 * px }}
                    >
                      {new Date(d * 86_400_000).getUTCDate()}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* body */}
          <div className="flex">
            <div
              className="sticky left-0 z-20 bg-card border-r border-border"
              style={{ width: LEFT }}
            >
              {rows.map((r) => {
                const open = r.collapsibleKey ? !collapsed.has(r.collapsibleKey) : false;
                return (
                  <div
                    key={r.key}
                    className="flex items-center gap-1.5 pr-2 border-b border-border/60 hover:bg-accent/40"
                    style={{ height: ROW, paddingLeft: 8 + r.depth * 18 }}
                  >
                    {r.collapsibleKey ? (
                      <button
                        type="button"
                        onClick={() => toggle(r.collapsibleKey!)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      {r.kind === "phase" ? (
                        <button
                          type="button"
                          className="block max-w-full truncate text-left text-sm font-medium hover:underline"
                          onClick={() => onOpenPhase(r.phaseId!)}
                          title="Open phase"
                        >
                          {r.label}
                        </button>
                      ) : (
                        <p
                          className={`truncate text-sm ${r.kind === "project" ? "font-semibold" : ""} ${r.done && r.kind !== "project" ? "line-through text-muted-foreground" : ""}`}
                          title={r.label}
                        >
                          {r.label}
                        </p>
                      )}
                      {r.sublabel && (
                        <p className="text-[11px] text-muted-foreground truncate leading-tight">
                          {r.sublabel}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative" style={{ width: W, height: rows.length * ROW }}>
              {/* grid: weekend shading + month lines + today */}
              {zoom === "weeks" &&
                Array.from(
                  { length: days },
                  (_, i) =>
                    (dow(min + i) === 0 || dow(min + i) === 6) && (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 bg-muted/40"
                        style={{ left: i * px, width: px }}
                      />
                    ),
                )}
              {months.map((m) => (
                <div
                  key={m.day}
                  className="absolute top-0 bottom-0 border-l border-border/60"
                  style={{ left: x(m.day) }}
                />
              ))}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-destructive/70 z-10"
                style={{ left: x(today) + px / 2 }}
              />

              {rows.map((r, i) => {
                const eff = effective(r);
                const c = colors(r);
                const hasDates = eff.start != null && eff.end != null;
                const isBar = r.kind === "phase" || r.kind === "project";
                const draggable = canEdit && isBar && hasDates;
                const owner = r.sublabel ?? "";
                return (
                  <div
                    key={r.key}
                    className={`absolute left-0 right-0 border-b border-border/60 ${!hasDates && canEdit && isBar ? "cursor-copy hover:bg-accent/30" : ""}`}
                    style={{ top: i * ROW, height: ROW }}
                    onClick={(e) => createBar(e, r)}
                  >
                    {hasDates && isBar && (
                      <div
                        className={`absolute top-[7px] rounded-md overflow-hidden group ${c.track} ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${r.kind === "project" ? "h-6 ring-1 ring-foreground/20" : "h-6"}`}
                        style={{
                          left: x(eff.start!),
                          width: Math.max((eff.end! - eff.start! + 1) * px, 8),
                        }}
                        title={`${r.label}\n${fmtDate(toStr(eff.start!))} → ${fmtDate(toStr(eff.end!))}\n${r.progress}% done${owner ? `\n${owner}` : ""}${r.overdue ? "\nOverdue" : ""}`}
                        onPointerDown={(e) => startDrag(e, r, "move")}
                        onPointerMove={moveDrag}
                        onPointerUp={(e) => endDrag(r, e)}
                        onPointerCancel={() => setDrag(null)}
                      >
                        <div
                          className={`h-full ${c.fill} pointer-events-none`}
                          style={{ width: `${r.progress}%` }}
                        />
                        {(eff.end! - eff.start! + 1) * px > 70 && (
                          <span className="absolute inset-0 px-2 flex items-center text-[11px] font-medium text-foreground/80 pointer-events-none truncate">
                            {r.progress}%
                          </span>
                        )}
                        {draggable && (
                          <>
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-foreground/20"
                              onPointerDown={(e) => startDrag(e, r, "start")}
                              onPointerMove={moveDrag}
                              onPointerUp={(e) => endDrag(r, e)}
                            />
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-foreground/20"
                              onPointerDown={(e) => startDrag(e, r, "end")}
                              onPointerMove={moveDrag}
                              onPointerUp={(e) => endDrag(r, e)}
                            />
                          </>
                        )}
                      </div>
                    )}
                    {!hasDates && isBar && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground italic">
                        {canEdit ? "No dates — click to add" : "No dates set"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-primary" /> In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-success" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-destructive" /> Overdue / blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-muted-foreground/50" /> Not started
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-destructive" /> Today
        </span>
      </div>
    </div>
  );
}
