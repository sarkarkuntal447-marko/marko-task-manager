import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { createTask, updateTask } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { statusLabel, todayStr, priorityLabel } from "@/lib/format";
import {
  PRIORITIES,
  TASK_STATUSES,
  type Priority,
  type TaskDoc,
  type TaskStatus,
} from "@/lib/types";

type EditableTask = Pick<
  TaskDoc,
  | "id"
  | "task_date"
  | "project_id"
  | "name"
  | "priority"
  | "status"
  | "start_date"
  | "end_date"
  | "notes"
>;

const blank = () => ({
  task_date: todayStr(),
  project_id: "",
  name: "",
  priority: "medium" as Priority,
  status: "not_started" as TaskStatus,
  start_date: todayStr(),
  end_date: todayStr(),
  notes: "",
});

/** Add a task (no `task`) or edit one. Render it only while open so the form starts fresh. */
export function TaskFormDialog({
  task,
  projects,
  onOpenChange,
  onSaved,
}: {
  task?: EditableTask;
  projects: Array<{ id: string; name: string }>;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() =>
    task
      ? {
          task_date: task.task_date,
          project_id: task.project_id ?? "",
          name: task.name,
          priority: task.priority,
          status: task.status,
          start_date: task.start_date ?? "",
          end_date: task.end_date ?? "",
          notes: task.notes ?? "",
        }
      : blank(),
  );
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const data = {
        task_date: form.task_date,
        project_id: form.project_id,
        name: form.name.trim(),
        priority: form.priority,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes.trim() || null,
      };
      if (task) {
        const { task_date: _date, ...changes } = data;
        await updateTask({ data: { id: task.id, changes } });
      } else await createTask({ data });
    },
    onSuccess: () => {
      toast.success(task ? "Task updated" : "Task added");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // A task edited after its project was removed keeps showing that project as missing.
  const projectMissing = !!form.project_id && !projects.some((p) => p.id === form.project_id);
  const datesWrong = !!form.start_date && !!form.end_date && form.end_date < form.start_date;
  const ready =
    !!form.task_date && !!form.project_id && !!form.name.trim() && !projectMissing && !datesWrong;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Add Task"}</DialogTitle>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date *</Label>
            {/* Tasks are logged for today; the date can't be changed. */}
            <DatePicker value={form.task_date} onChange={() => {}} disabled />
          </div>
          <div className="space-y-2">
            <Label>Project *</Label>
            <Select value={form.project_id} onValueChange={(v) => set("project_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    You are not on any project yet.
                  </div>
                ) : (
                  projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {projectMissing && (
              <p className="text-xs text-destructive">
                This project is no longer available. Choose another.
              </p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Task *</Label>
            <Textarea
              rows={4}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={"1. What you worked on\n2. …"}
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as TaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <DatePicker value={form.start_date} onChange={(v) => set("start_date", v)} />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <DatePicker value={form.end_date} onChange={(v) => set("end_date", v)} />
            {datesWrong && (
              <p className="text-xs text-destructive">End date cannot be before the start date.</p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!ready || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : task ? "Save Changes" : "Add Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
