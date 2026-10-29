import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createUser, listMembers, setMemberActive, setMemberRole } from "@/lib/app.functions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DepartmentFilter, TeamTabs } from "@/components/team-tabs";
import { matchesDepartment, type DepartmentFilterValue } from "@/lib/format";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ShieldCheck, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, type AppRole, type Department } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/team/members")({
  head: () => ({ meta: [{ title: "Member Management — Marko Projects" }] }),
  component: MembersPage,
});

const ROLES: AppRole[] = ["Developer", "SEO", "Admin", "Super_Admin"];
const roleLabel: Record<AppRole, string> = {
  Super_Admin: "Super Admin",
  Admin: "Admin",
  SEO: "SEO",
  Developer: "Developer",
};

type Member = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  designation?: string | null;
  department?: string | null;
  role: AppRole;
  active: boolean;
};

function MembersPage() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const isSuper = me?.role === "Super_Admin";
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<DepartmentFilterValue>("all");
  const [addOpen, setAddOpen] = useState(false);

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ["all-members"],
    queryFn: async () => (await listMembers()) as Member[],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["all-members"] });
    qc.invalidateQueries({ queryKey: ["team-members"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const changeRole = useMutation({
    mutationFn: (v: { userId: string; role: AppRole }) => setMemberRole({ data: v }),
    onSuccess: (r) => {
      toast.success(`Role changed to ${roleLabel[r.role]}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setMemberActive({ data: v }),
    onSuccess: (r) => {
      toast.success(r.active ? "Account enabled" : "Account disabled");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mirrors the server rules: everyone can view, only a super admin can change, and nobody
  // changes their own account here.
  const lockReason = (m: Member): string | null => {
    if (!isSuper) return "Only a super admin can make changes";
    if (m.id === me?.user.id) return "This is you";
    return null;
  };

  const term = q.trim().toLowerCase();
  const filtered = members.filter(
    (m) =>
      matchesDepartment(m.department, dept) &&
      (!term ||
        [m.full_name, m.email, m.designation, m.department, roleLabel[m.role]]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)),
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground">
            {isSuper
              ? "Manage roles and account access for every member."
              : "Roles and account status of every member. Only a super admin can make changes."}
          </p>
        </div>
        {isSuper && (
          <Button className="w-full sm:w-auto" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Add Member
          </Button>
        )}
      </div>

      <TeamTabs />

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> All Members
            <span className="text-xs font-normal text-muted-foreground">({members.length})</span>
          </h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <DepartmentFilter value={dept} onChange={setDept} />
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, role…"
                className="pl-9 pr-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  title="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isLoading && <ListRowsSkeleton rows={5} />}
          {!isLoading && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No members found.</p>
          )}
          {filtered.map((m) => {
            const locked = lockReason(m);
            return (
              <div
                key={m.id}
                className={cn(
                  "p-3 border border-border rounded-lg flex flex-wrap items-center gap-3",
                  !m.active && "bg-muted/40",
                )}
              >
                <div className="flex-1 min-w-[12rem]">
                  <p className="font-medium break-words flex items-center gap-2">
                    {m.full_name ?? "—"}
                    {!m.active && (
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                        Disabled
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground break-all">
                    {[m.designation, m.department, m.email].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <Select
                  value={m.role}
                  disabled={!!locked || changeRole.isPending}
                  onValueChange={(v) => {
                    if (v !== m.role) changeRole.mutate({ userId: m.id, role: v as AppRole });
                  }}
                >
                  <SelectTrigger className="w-full sm:w-40 h-9" title={locked ?? "Change role"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabel[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ActiveToggle
                  checked={m.active}
                  disabled={!!locked || toggleActive.isPending}
                  title={locked ?? (m.active ? "Disable account" : "Enable account")}
                  onChange={(active) => toggleActive.mutate({ userId: m.id, active })}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {isSuper && <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} onCreated={refresh} />}
    </div>
  );
}

function ActiveToggle({
  checked,
  disabled,
  title,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-success" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="w-14 text-left text-xs font-medium text-muted-foreground">
        {checked ? "Active" : "Disabled"}
      </span>
    </button>
  );
}

const emptyForm = {
  email: "",
  password: "",
  full_name: "",
  designation: "",
  department: "" as Department | "",
  role: "Developer" as AppRole,
};

function AddMemberDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(emptyForm);

  const m = useMutation({
    mutationFn: () =>
      createUser({
        data: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          designation: form.designation || undefined,
          department: form.department || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Member added. Share the credentials with them.");
      setForm(emptyForm);
      onOpenChange(false);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to add member"),
  });

  const invalid = !form.email || !form.full_name || form.password.length < 6;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!m.isPending) onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add Team Member
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) m.mutate();
          }}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Full name *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Temporary password *</Label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="min 6 chars"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={form.department}
                onValueChange={(v) => setForm({ ...form, department: v as Department })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={m.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={invalid || m.isPending}>
              <UserPlus className="h-4 w-4 mr-2" />
              {m.isPending ? "Adding…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
