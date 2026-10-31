import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Reusable loading placeholders ("skeletons").
 *
 * Rule of thumb: keep static things real (page titles, buttons, tabs) and only
 * replace the parts that wait for data. Each skeleton below copies the size and
 * layout of the real content (at every breakpoint) so the page does not "jump"
 * when data arrives.
 */

/** Dashboard: one small stat card (icon + label + number). */
export function MetricCardSkeleton() {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg shrink-0" />
        <div className="space-y-2 min-w-0 flex-1">
          <Skeleton className="h-3 w-full max-w-20" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
    </Card>
  );
}

/** Dashboard: a card that will hold a chart. */
export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={`p-4 sm:p-6 ${className ?? ""}`}>
      <Skeleton className="h-5 w-36 mb-4" />
      <Skeleton className="h-56 sm:h-64 w-full" />
    </Card>
  );
}

/** A list of rows: title + subtitle on the left, badges on the right. Used on many pages. */
export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-lg border border-border flex flex-wrap items-center gap-3"
        >
          <div className="flex-1 min-w-[10rem] space-y-2">
            <Skeleton className="h-4 w-3/4 sm:w-1/2" />
            <Skeleton className="h-3 w-1/2 sm:w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Title + subtitle at the top of a page (for pages whose heading depends on data). */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 sm:h-8 w-48 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Projects page (phones): the stacked card list used instead of the table. */
export function ProjectCardsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-1.5 w-full" />
        </Card>
      ))}
    </div>
  );
}

/** Projects page: timeline card + table (cards on phones). */
export function ProjectsListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      <Card className="p-4 sm:p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-20 sm:w-32 shrink-0" />
              <Skeleton className="h-6 flex-1" />
            </div>
          ))}
        </div>
      </Card>
      <div className="sm:hidden">
        <ProjectCardsSkeleton rows={Math.min(rows, 4)} />
      </div>
      <Card className="overflow-hidden hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="hidden md:table-cell">Progress</TableHead>
              <TableHead className="hidden lg:table-cell">Due Date</TableHead>
              <TableHead className="hidden xl:table-cell">Client</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-2 w-24" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

/** Team page: one member card. */
export function TeamCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-28 max-w-full" />
          <Skeleton className="h-3 w-20 max-w-full" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full shrink-0" />
      </div>
      <Skeleton className="h-3 w-24 mt-4" />
      <div className="mt-4 pt-3 border-t border-border">
        <Skeleton className="h-3 w-20" />
      </div>
    </Card>
  );
}

/** Team member detail page. */
export function MemberDetailSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <Skeleton className="h-4 w-28" />
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-6 w-48 max-w-full" />
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-4 sm:p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <ListRowsSkeleton rows={3} />
          </Card>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 sm:p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Project detail page: header, 4 summary cards, tabs and a list. */
export function ProjectDetailSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Skeleton className="h-9 sm:w-28" />
          <Skeleton className="h-9 sm:w-32" />
          <Skeleton className="h-9 col-span-2 sm:w-48" />
        </div>
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 sm:p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </Card>
        ))}
      </div>
      <Skeleton className="h-9 w-full sm:w-80" />
      <Card className="p-4 sm:p-6">
        <Skeleton className="h-5 w-36 mb-4" />
        <ListRowsSkeleton rows={4} />
      </Card>
    </div>
  );
}

/** Project team tab: one assigned-member chip (avatar + name). */
export function MemberChipSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-border flex items-center gap-3">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-28 max-w-full" />
        <Skeleton className="h-3 w-20 max-w-full" />
      </div>
    </div>
  );
}

/** Single phase page. */
export function PhaseDetailSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto">
      <Skeleton className="h-4 w-40" />
      <Card className="p-4 sm:p-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40 max-w-full" />
          <Skeleton className="h-6 w-56 max-w-full" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-12 w-full" />
      </Card>
    </div>
  );
}

/** Project timeline tab: toolbar + a gantt-like grid. */
export function TimelineSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border/60 last:border-0 h-[38px] px-3"
          >
            <Skeleton className="h-3 w-24 sm:w-48 shrink-0" />
            <div className="flex-1 relative h-6">
              <Skeleton
                className="absolute h-6"
                style={{ left: `${(i * 13) % 50}%`, width: `${25 + ((i * 7) % 30)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A settings-style card with a few form fields. */
export function FormCardSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <Skeleton className="h-5 w-32" />
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-full sm:w-32" />
      </div>
    </Card>
  );
}

/** Whole-page placeholder shown while the login session is being checked. Mirrors AppShell at every size. */
export function AppShellSkeleton() {
  return (
    <div className="min-h-dvh w-full flex bg-background">
      <aside className="hidden md:flex md:w-20 lg:w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-dvh">
        <div className="h-16 flex items-center gap-3 px-5 md:max-lg:justify-center md:max-lg:px-0 border-b border-sidebar-border">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <Skeleton className="h-5 w-28 md:max-lg:hidden" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="p-3 border-t border-sidebar-border flex items-center gap-3 md:max-lg:justify-center">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 md:max-lg:hidden">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 md:h-16 px-3 sm:px-4 md:px-8 border-b border-border bg-card/80 flex items-center gap-2 pt-[env(safe-area-inset-top)] box-content">
          <Skeleton className="h-8 w-8 md:hidden" />
          <Skeleton className="h-8 w-8 rounded-full md:hidden" />
          <Skeleton className="h-5 w-28 md:hidden" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <main className="flex-1 px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
          <PageHeaderSkeleton />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
          <Card className="p-4 sm:p-6">
            <ListRowsSkeleton rows={4} />
          </Card>
        </main>
      </div>
      <div className="md:hidden fixed inset-x-0 bottom-0 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-1.5">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-2 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
