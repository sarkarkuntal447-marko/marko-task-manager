import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { changeMyPassword, updateMyProfile } from "@/lib/app.functions";
import { Card } from "@/components/ui/card";
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
import { Eye, EyeOff, KeyRound, Save } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { FormCardSkeleton } from "@/components/skeletons";
import { AVAILABILITY, type Availability } from "@/lib/types";
import { availabilityLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Marko Projects" }] }),
  component: SettingsPage,
});

// Adding members and changing roles now lives in Team → Member Management.
function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Your profile and workspace controls.
        </p>
      </div>

      <ProfileForm />
      <ChangePasswordForm />
    </div>
  );
}

const noPasswords = { current: "", next: "", confirm: "" };

/** Members replace the temporary password they were given with their own. */
function ChangePasswordForm() {
  const [form, setForm] = useState(noPasswords);
  const [show, setShow] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      changeMyPassword({ data: { current_password: form.current, new_password: form.next } }),
    onSuccess: () => {
      toast.success("Password changed. Other devices have been signed out.");
      setForm(noPasswords);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tooShort = !!form.next && form.next.length < 6;
  const mismatch = !!form.confirm && form.next !== form.confirm;
  const ready = !!form.current && form.next.length >= 6 && form.next === form.confirm;
  const type = show ? "text" : "password";

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="font-semibold mb-1">Change Password</h2>
          <p className="text-xs text-muted-foreground">
            Replace the temporary password you were given with one only you know.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide passwords" : "Show passwords"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <form
        className="grid sm:grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) save.mutate();
        }}
      >
        <div className="space-y-2 sm:col-span-2 sm:max-w-[calc(50%-0.375rem)]">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type={type}
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type={type}
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
          {tooShort && <p className="text-xs text-destructive">Use at least 6 characters.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type={type}
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
          {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
        </div>
        <div className="flex justify-end sm:col-span-2 mt-1">
          <Button type="submit" className="w-full sm:w-auto" disabled={!ready || save.isPending}>
            <KeyRound className="h-4 w-4 mr-2" />
            {save.isPending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileForm() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useCurrentUser();
  const [form, setForm] = useState({
    full_name: "",
    designation: "",
    phone: "",
    joining_date: "",
    availability: "available" as Availability,
  });

  useEffect(() => {
    if (me?.profile) {
      setForm({
        full_name: me.profile.full_name ?? "",
        designation: me.profile.designation ?? "",
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
          {/* Department decides which projects and tasks you see, so only a super admin sets it. */}
          <Input
            value={me?.profile?.department ?? "Not set"}
            readOnly
            disabled
            title="Only a super admin can change your department"
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
