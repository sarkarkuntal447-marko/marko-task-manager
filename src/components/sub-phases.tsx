import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { addSubPhases, updateSubPhase, deleteSubPhase } from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { fmtDate } from "@/lib/format";

type Sub = {
  id: string;
  name: string;
  completed: boolean;
  start_date?: string | null;
  end_date?: string | null;
};
type Editing = { id: string; name: string; start_date: string; end_date: string };

/** Expandable panel under a phase: lists its sub-phases and lets admins add several at once. */
export function SubPhases({
  projectId,
  phase,
  canManage,
  onChanged,
  bare,
}: {
  projectId: string;
  phase: { id: string; sub_phases?: Sub[] };
  canManage: boolean;
  onChanged: () => void;
  bare?: boolean;
}) {
  const [text, setText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const subs = phase.sub_phases ?? [];
  const fail = (e: Error) => toast.error(e.message);

  const add = useMutation({
    // Pasting several lines (or separating with commas/semicolons) adds several sub-phases in one go.
    // The start / end date chosen next to the name applies to every sub-phase added in that go.
    mutationFn: (names: string[]) =>
      addSubPhases({
        data: {
          projectId,
          phaseId: phase.id,
          names,
          ...(startDate ? { start_date: startDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        },
      }),
    onSuccess: () => {
      setText("");
      setStartDate("");
      setEndDate("");
      onChanged();
    },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (v: { subId: string; completed: boolean }) =>
      updateSubPhase({
        data: { projectId, phaseId: phase.id, subId: v.subId, changes: { completed: v.completed } },
      }),
    onSuccess: onChanged,
    onError: fail,
  });
  const save = useMutation({
    mutationFn: (v: Editing) =>
      updateSubPhase({
        data: {
          projectId,
          phaseId: phase.id,
          subId: v.id,
          changes: {
            name: v.name,
            start_date: v.start_date || null,
            end_date: v.end_date || null,
          },
        },
      }),
    onSuccess: () => {
      setEditing(null);
      onChanged();
    },
    onError: fail,
  });
  const saveEdit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      setEditing(null);
      return;
    }
    if (editing.start_date && editing.end_date && editing.end_date < editing.start_date) {
      toast.error("End date cannot be before the start date.");
      return;
    }
    save.mutate({ ...editing, name });
  };
  const remove = useMutation({
    mutationFn: (subId: string) =>
      deleteSubPhase({ data: { projectId, phaseId: phase.id, subId } }),
    onSuccess: onChanged,
    onError: fail,
  });

  const submit = () => {
    const names = text
      .split(/[\n;,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    if (startDate && endDate && endDate < startDate) {
      toast.error("End date cannot be before the start date.");
      return;
    }
    add.mutate(names);
  };

  return (
    <div className={bare ? "space-y-2" : "mt-3 ml-7 pl-4 border-l-2 border-border space-y-2"}>
      {subs.length === 0 && (
        <p className="text-sm text-muted-foreground">No sub-phases yet. Add the first one below.</p>
      )}
      {subs.map((s) => (
        <div key={s.id} className="flex items-center gap-2 flex-wrap">
          <Checkbox
            checked={s.completed}
            disabled={!canManage || toggle.isPending}
            onCheckedChange={(v) => toggle.mutate({ subId: s.id, completed: !!v })}
          />
          {editing?.id === s.id ? (
            <>
              <Input
                autoFocus
                className="h-8 flex-1 min-w-[10rem]"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditing(null);
                }}
              />
              <div className="w-40">
                <DatePicker
                  placeholder="Start date"
                  value={editing.start_date}
                  onChange={(v) => setEditing({ ...editing, start_date: v })}
                />
              </div>
              <div className="w-40">
                <DatePicker
                  placeholder="End date"
                  value={editing.end_date}
                  onChange={(v) => setEditing({ ...editing, end_date: v })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={save.isPending}
                onClick={saveEdit}
                title="Save"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setEditing(null)}
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <div className="flex-1 min-w-0">
              <span
                className={`text-sm break-words ${s.completed ? "line-through text-muted-foreground" : ""}`}
              >
                {s.name}
              </span>
              {(s.start_date || s.end_date) && (
                <p className="text-xs text-muted-foreground">
                  {fmtDate(s.start_date)} → {fmtDate(s.end_date)}
                </p>
              )}
            </div>
          )}
          {canManage && editing?.id !== s.id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setEditing({
                  id: s.id,
                  name: s.name,
                  start_date: s.start_date ?? "",
                  end_date: s.end_date ?? "",
                })
              }
              title="Edit sub-phase"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canManage && editing?.id !== s.id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={remove.isPending}
              onClick={() => remove.mutate(s.id)}
              title="Delete sub-phase"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
      {canManage && (
        <div className="flex gap-2 pt-1 flex-wrap">
          <Input
            className="flex-1 min-w-[12rem]"
            value={text}
            placeholder="Add sub-phase (press Enter; use commas to add several)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="w-44">
            <DatePicker placeholder="Start date" value={startDate} onChange={setStartDate} />
          </div>
          <div className="w-44">
            <DatePicker placeholder="End date" value={endDate} onChange={setEndDate} />
          </div>
          <Button size="sm" onClick={submit} disabled={!text.trim() || add.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
