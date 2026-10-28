import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  updateMyProfile,
  listRoleMembers,
  addRole as addRoleFn,
  removeRole as removeRoleFn,
  createUser,
} from "@/lib/app.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { ShieldCheck, Trash2, UserPlus, Save } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useServerFn } from "@tanstack/react-start";
import { FormCardSkeleton, ListRowsSkeleton } from "@/components/skeletons";
import type { AppRole, Availability } from "@/lib/types";
import { availabilityLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Marko Projects" }] }),
  component: SettingsPage,
});

const ROLES = ["Developer", "SEO", "Admin", "Super_Admin"] as const;
const AVAILABILITY = ["available", "busy", "on_leave"] as const;

function SettingsPage() {
  const { data: me } = useCurrentUser();
  const isSuper = me?.role === "Super_Admin";
  const isAdmin = isSuper || me?.role === "Admin";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Your profile and workspace controls.
        </p>
      </div>

      <ProfileForm />

      {isAdmin && <AddUserForm canPromoteSuper={!!isSuper} />}
      {isSuper && <RoleManager />}
    </div>
  );
}

function ProfileForm() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useCurrentUser();
  const [form, setForm] = useState({
    full_name: "",
    designation: "",
    department: "",
    phone: "",
    joining_date: "",
    availability: "available" as Availability,
  });

  useEffect(() => {
    if (me?.profile) {
      setForm({
        full_name: me.profile.full_name ?? "",
        designation: me.profile.designation ?? "",
        department: me.profile.department ?? "",
        phone: me.profile.phone ?? "",
        joining_date: me.profile.joining_date ?? "",
        availability: me.profile.availability ?? "available",
      });
    }
  }, [me?.profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!me?.user.id) return;
      await updateMyProfile({
        data: {
          full_name: form.full_name || null,
          designation: form.designation || null,
          department: form.department || null,
          phone: form.phone || null,
          joining_date: form.joining_date || null,
          availability: form.availability,
        },
      });
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["current-user"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <FormCardSkeleton />;

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="font-semibold mb-1">My Profile</h2>
      <p className="text-xs text-muted-foreground mb-4 break-all">{me?.user.email}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
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
          <Input
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Joining date</Label>
          <DatePicker
            value={form.joining_date}
            onChange={(v) => setForm({ ...form, joining_date: v })}
          />
        </div>
        <div className="space-y-2">
          <Label>Availability</Label>
          <Select
            value={form.availability}
            onValueChange={(v) => setForm({ ...form, availability: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABILITY.map((a) => (
                <SelectItem key={a} value={a}>
                  {availabilityLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button
          className="w-full sm:w-auto"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          <Save className="h-4 w-4 mr-2" /> Save changes
        </Button>
      </div>
    </Card>
  );
}

function AddUserForm({ canPromoteSuper }: { canPromoteSuper: boolean }) {
  const qc = useQueryClient();
  const create = useServerFn(createUser);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    designation: "",
    department: "",
    role: "Developer" as AppRole,
  });

  const m = useMutation({
    mutationFn: async () => create({ data: form }),
    onSuccess: () => {
      toast.success("User created. Share the credentials with them.");
      setForm({
        email: "",
        password: "",
        full_name: "",
        designation: "",
        department: "",
        role: "Developer" as AppRole,
      });
      qc.invalidateQueries({ queryKey: ["all-members-roles"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create user"),
  });

  const allowed = canPromoteSuper ? ROLES : ROLES.filter((r) => r !== "Super_Admin");

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <UserPlus className="h-4 w-4" /> Add Team Member
      </h2>
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
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowed.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
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
          <Input
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button
          className="w-full sm:w-auto"
          onClick={() => m.mutate()}
          disabled={
            m.isPending ||
            !form.email ||
            !form.password ||
            !form.full_name ||
            form.password.length < 6
          }
        >
          <UserPlus className="h-4 w-4 mr-2" /> Create user
        </Button>
      </div>
    </Card>
  );
}

function RoleManager() {
  const qc = useQueryClient();

  const { data: members = [], isLoading } = useQuery<
    Array<{
      id: string;
      full_name?: string | null;
      designation?: string | null;
      roles: Array<{ id: string; role: string }>;
    }>
  >({
    queryKey: ["all-members-roles"],
    queryFn: async () =>
      (await listRoleMembers()) as Array<{
        id: string;
        full_name?: string | null;
        designation?: string | null;
        roles: Array<{ id: string; role: string }>;
      }>,
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await addRoleFn({ data: { userId, role } });
    },
    onSuccess: () => {
      toast.success("Role assigned");
      qc.invalidateQueries({ queryKey: ["all-members-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async (id: string) => {
      await removeRoleFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["all-members-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" /> Role Management
      </h2>
      <div className="space-y-3">
        {isLoading && <ListRowsSkeleton rows={3} />}
        {members.map((m) => (
          <div
            key={m.id}
            className="p-3 border border-border rounded-lg flex flex-wrap items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium break-words">{m.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{m.designation ?? ""}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {m.roles.length === 0 && <Badge variant="secondary">developer</Badge>}
              {m.roles.map((r) => (
                <Badge key={r.id} variant="secondary" className="gap-1">
                  {r.role}
                  <button
                    onClick={() => removeRole.mutate(r.id)}
                    className="hover:text-destructive p-0.5 -m-0.5"
                    title="Remove role"
                    aria-label={`Remove ${r.role} role`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Select onValueChange={(v) => addRole.mutate({ userId: m.id, role: v as AppRole })}>
              <SelectTrigger className="w-full sm:w-40 h-8">
                <SelectValue placeholder="Assign role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </Card>
  );
}
