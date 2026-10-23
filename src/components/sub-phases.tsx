import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { addSubPhases, updateSubPhase, deleteSubPhase } from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Sub = { id: string; name: string; completed: boolean };

/** Expandable panel under a phase: lists its sub-phases and lets admins add several at once. */
export function SubPhases({ projectId, phase, canManage, onChanged, bare }: {
  projectId: string; phase: { id: string; sub_phases?: Sub[] }; canManage: boolean; onChanged: () => void; bare?: boolean;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const subs = phase.sub_phases ?? [];
  const fail = (e: Error) => toast.error(e.message);

  const add = useMutation({
    // Pasting several lines (or separating with commas/semicolons) adds several sub-phases in one go.
    mutationFn: (names: string[]) => addSubPhases({ data: { projectId, phaseId: phase.id, names } }),
    onSuccess: () => { setText(""); onChanged(); },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (v: { subId: string; completed: boolean }) =>
      updateSubPhase({ data: { projectId, phaseId: phase.id, subId: v.subId, changes: { completed: v.completed } } }),
    onSuccess: onChanged, onError: fail,
  });
  const rename = useMutation({
    mutationFn: (v: { subId: string; name: string }) =>
      updateSubPhase({ data: { projectId, phaseId: phase.id, subId: v.subId, changes: { name: v.name } } }),
    onSuccess: () => { setEditing(null); onChanged(); }, onError: fail,
  });
  const saveEdit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (name) rename.mutate({ subId: editing.id, name }); else setEditing(null);
  };
  const remove = useMutation({
    mutationFn: (subId: string) => deleteSubPhase({ data: { projectId, phaseId: phase.id, subId } }),
    onSuccess: onChanged, onError: fail,
  });

  const submit = () => {
    const names = text.split(/[\n;,]+/).map((s) => s.trim()).filter(Boolean);
    if (names.length) add.mutate(names);
  };

  return (
    <div className={bare ? "space-y-2" : "mt-3 ml-7 pl-4 border-l-2 border-border space-y-2"}>
      {subs.length === 0 && <p className="text-sm text-muted-foreground">No sub-phases yet. Add the first one below.</p>}
      {subs.map((s) => (
        <div key={s.id} className="flex items-center gap-2 min-h-9">
          <Checkbox checked={s.completed} disabled={!canManage || toggle.isPending}
            onCheckedChange={(v) => toggle.mutate({ subId: s.id, completed: !!v })} />
          {editing?.id === s.id ? (
            <>
              <Input autoFocus className="h-8" value={editing.name}
                onChange={(e) => setEditing({ id: s.id, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }} />
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={rename.isPending} onClick={saveEdit} title="Save"><Check className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(null)} title="Cancel"><X className="h-3.5 w-3.5" /></Button>
            </>
          ) : (
            <span className={`flex-1 text-sm break-words ${s.completed ? "line-through text-muted-foreground" : ""}`}>{s.name}</span>
          )}
          {canManage && editing?.id !== s.id && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing({ id: s.id, name: s.name })} title="Edit sub-phase">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canManage && editing?.id !== s.id && (
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={remove.isPending} onClick={() => remove.mutate(s.id)} title="Delete sub-phase">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
      {canManage && (
        <div className="flex flex-col min-[400px]:flex-row gap-2 pt-1">
          <Input
            value={text} placeholder="Add sub-phase (press Enter; use commas to add several)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          />
          <Button size="sm" onClick={submit} disabled={!text.trim() || add.isPending}><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>
      )}
    </div>
  );
}
