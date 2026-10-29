import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { updateMyProfile } from "@/lib/app.functions";
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
import { Save } from "lucide-react";
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
