import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { listApplicationLogs } from "@/lib/app.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity as ActivityIcon,
  FolderPlus,
  UserPlus,
  UserMinus,
  CheckCircle2,
  ListTodo,
  ShieldCheck,
  Search,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { statusLabel } from "@/lib/format";
import { ListRowsSkeleton } from "@/components/skeletons";

type ActivityEntry = {
  id: string;
  action: string;
  entity_name?: string | null;
  actor_name?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

// Filter categories map to the prefix of the activity action (e.g. "task.created" → "task").
const CATEGORIES = [
  { value: "all", label: "All activity" },
  { value: "project", label: "Projects" },
  { value: "task", label: "Tasks" },
  { value: "member", label: "Team" },
  { value: "role", label: "Roles" },
] as const;
type Category = (typeof CATEGORIES)[number]["value"];

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Application Logs — Marko Projects" }] }),
  beforeLoad: ({ context }) => {
    if (context.role !== "Admin" && context.role !== "Super_Admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LogsPage,
});

/** Everything a user might type to find an entry: names, the action and the readable status. */
function searchText(a: ActivityEntry) {
  const meta = a.metadata ?? {};
  const extras = Object.values(meta)
    .filter((v): v is string => typeof v === "string")
    .map((v) => `${v} ${statusLabel(v)}`);
  return [a.action.replace(/[._]/g, " "), a.entity_name, a.actor_name, ...extras]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function LogsPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [showAll, setShowAll] = useState(false);

  // Cutoff: start of yesterday (so today + previous day are included)
  const recentCutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  const { data: activity = [], isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["activity-log", showAll],
    queryFn: async () => {
      const result = await listApplicationLogs({
        data: showAll ? { limit: 500 } : { since: recentCutoff },
      });
      return result as ActivityEntry[];
    },
  });

  const filtered = useMemo(() => {
    // Every word must match somewhere, so "rahul completed" finds Rahul's completed tasks.
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return activity.filter((a) => {
      if (category !== "all" && !a.action.startsWith(category + ".")) return false;
      if (!terms.length) return true;
      const text = searchText(a);
      return terms.every((t) => text.includes(t));
    });
  }, [activity, q, category]);

  const filtering = !!q || category !== "all";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold">Application Logs</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Everything that happens across the workspace, in real time.
        </p>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by person, project, task or action…"
              className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQ("");
              }}
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
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground sm:ml-auto">
            {isLoading
              ? "Loading…"
              : `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}${showAll ? "" : " · today & yesterday"}`}
          </p>
        </div>

        {isLoading ? (
          <ListRowsSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {filtering ? "No logs match your search." : "No activity yet."}
            </p>
            {filtering && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setCategory("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((a) => (
              <ActivityRow key={a.id} a={a} />
            ))}
          </ul>
        )}
        {!showAll && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
              See older activity
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function ActivityRow({ a }: { a: ActivityEntry }) {
  const { icon, text } = describeActivity(a);
  return (
    <li className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-card">
      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0 text-accent-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm break-words">{text}</p>
        <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
      </div>
    </li>
  );
}

function describeActivity(a: ActivityEntry): { icon: ReactNode; text: ReactNode } {
  const who = a.actor_name ?? "Someone";
  switch (a.action) {
    case "project.created":
      return {
        icon: <FolderPlus className="h-4 w-4" />,
        text: (
          <>
            <b>{who}</b> created project <b>{a.entity_name}</b>
          </>
        ),
      };
    case "member.removed":
      return {
        icon: <UserMinus className="h-4 w-4" />,
        text: (
          <>
            <b>{who}</b> removed <b>{a.entity_name}</b> from the workspace
          </>
        ),
      };
    case "member.disabled":
    case "member.enabled":
      return {
        icon:
          a.action === "member.enabled" ? (
            <UserCheck className="h-4 w-4" />
          ) : (
            <UserX className="h-4 w-4" />
          ),
        text: (
          <>
            <b>{who}</b> {a.action === "member.enabled" ? "enabled" : "disabled"} the account of{" "}
            <b>{a.entity_name}</b>
          </>
        ),
      };
    case "member.joined":
      return {
        icon: <UserPlus className="h-4 w-4" />,
        text: (
          <>
            <b>{a.entity_name}</b> joined the workspace
          </>
        ),
      };
    case "task.created":
      return {
        icon: <ListTodo className="h-4 w-4" />,
        text: (
          <>
            <b>{who}</b> added task <b>{a.entity_name}</b>
          </>
        ),
      };
    case "task.status_changed": {
      const to =
        typeof a.metadata === "object" && a.metadata !== null && "to" in a.metadata
          ? a.metadata.to
          : undefined;
      const statusText = typeof to === "string" ? statusLabel(to) : "status";
      return {
        icon:
          to === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <ActivityIcon className="h-4 w-4" />
          ),
        text: (
          <>
            <b>{who}</b> moved <b>{a.entity_name}</b> to <b>{statusText}</b>
          </>
        ),
      };
    }
    case "role.assigned":
      return {
        icon: <ShieldCheck className="h-4 w-4" />,
        text: (
          <>
            <b>{who}</b> assigned role{" "}
            <b>{typeof a.metadata?.role === "string" ? a.metadata.role : "unknown role"}</b> to{" "}
            <b>{a.entity_name}</b>
          </>
        ),
      };
    default:
      return {
        icon: <ActivityIcon className="h-4 w-4" />,
        text: (
          <>
            {a.action} — {a.entity_name}
          </>
        ),
      };
  }
}
