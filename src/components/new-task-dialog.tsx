import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createTask } from "@/lib/app.functions";
import { listProjectPhases } from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusLabel } from "@/lib/format";

const STATUSES = ["pending", "in_progress", "blocked", "testing", "completed"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export function NewTaskDialog({ projects, onAdded }: { projects: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", project_id: "", phase_id: "", priority: "medium", status: "pending",
    due_date: new Date().toISOString().slice(0, 10),
  });
  const reset = () => setForm({ name: "", description: "", project_id: "", phase_id: "", priority: "medium", status: "pending", due_date: new Date().toISOString().slice(0, 10) });

  // Phases belong to a project, so load them once a project is picked.
  const { data: phases = [], isFetching: loadingPhases } = useQuery({
    queryKey: ["phases", form.project_id],
    queryFn: () => listProjectPhases({ data: { projectId: form.project_id } }),
    enabled: !!form.project_id && open,
  });

  const m = useMutation({
    mutationFn: async () => {
      await createTask({ data: {
        name: form.name,
        description: form.description || null,
        project_id: form.project_id || null,
        phase_id: form.phase_id || null,
        priority: form.priority as any,
        status: form.status as any,
        due_date: form.due_date || null,
      } });
    },
    onSuccess: () => { toast.success("Task added"); onAdded(); setOpen(false); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Task</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add to My Task List</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Task *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v, phase_id: "" })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phase</Label>
              <Select value={form.phase_id} onValueChange={(v) => setForm({ ...form, phase_id: v })} disabled={!form.project_id}>
                <SelectTrigger>
                  <SelectValue placeholder={!form.project_id ? "Select a project first" : loadingPhases ? "Loading…" : phases.length ? "None" : "No phases yet"} />
                </SelectTrigger>
                <SelectContent>{phases.map((ph: any) => <SelectItem key={ph.id} value={ph.id}>{ph.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Due</Label><DatePicker value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{statusLabel(p)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter><Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>Add Task</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
