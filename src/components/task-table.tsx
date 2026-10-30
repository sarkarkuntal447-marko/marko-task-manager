import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";
import { fmtDate, priorityColor, statusColor, statusLabel } from "@/lib/format";
import { TASK_STATUSES, type TaskDoc, type TaskStatus } from "@/lib/types";

export type TaskRow = Pick<
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
  | "assigned_to"
> & { project_name?: string | null };

/**
 * Tasks laid out like the daily sheet: Date, Project, Task, Priority, Status, Start, End, Notes.
 * Pass `ownerName` to add a Member column; pass the handlers to make rows editable.
 */
export function TaskTable({
  tasks,
  showProject = true,
  ownerName,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  tasks: TaskRow[];
  showProject?: boolean;
  ownerName?: (t: TaskRow) => string;
  onStatusChange?: (t: TaskRow, status: TaskStatus) => void;
  onEdit?: (t: TaskRow) => void;
  onDelete?: (t: TaskRow) => void;
}) {
  const editable = !!(onEdit || onDelete);
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[960px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Date</TableHead>
            {ownerName && <TableHead className="w-40">Member</TableHead>}
            {showProject && <TableHead className="w-44">Project</TableHead>}
            <TableHead>Task</TableHead>
            <TableHead className="w-24 text-center">Priority</TableHead>
            <TableHead className="w-36 text-center">Status</TableHead>
            <TableHead className="w-28">Start</TableHead>
            <TableHead className="w-28">End</TableHead>
            <TableHead className="w-48">Notes</TableHead>
            {editable && <TableHead className="w-20"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => (
            <TableRow key={t.id} className="align-top">
              <TableCell className="text-sm whitespace-nowrap">{fmtDate(t.task_date)}</TableCell>
              {ownerName && <TableCell className="text-sm font-medium">{ownerName(t)}</TableCell>}
              {showProject && (
                <TableCell className="text-sm">
                  {t.project_name ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
              )}
              <TableCell className="text-sm whitespace-pre-wrap break-words">{t.name}</TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className={priorityColor(t.priority)}>
                  {statusLabel(t.priority)}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                {onStatusChange ? (
                  <Select
                    value={t.status}
                    onValueChange={(v) => onStatusChange(t, v as TaskStatus)}
                  >
                    <SelectTrigger className={`h-8 w-32 mx-auto text-xs ${statusColor(t.status)}`}>
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
                ) : (
                  <Badge variant="secondary" className={statusColor(t.status)}>
                    {statusLabel(t.status)}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">{fmtDate(t.start_date)}</TableCell>
              <TableCell className="text-sm whitespace-nowrap">{fmtDate(t.end_date)}</TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                {t.notes || "—"}
              </TableCell>
              {editable && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit task"
                        onClick={() => onEdit(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete task"
                        onClick={() => onDelete(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
