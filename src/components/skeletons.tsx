import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Reusable loading placeholders ("skeletons").
 *
 * Rule of thumb: keep static things real (page titles, buttons, tabs) and only
 * replace the parts that wait for data. Each skeleton below copies the size and
 * layout of the real content so the page does not "jump" when data arrives.
 */

/** Dashboard: one small stat card (icon + label + number). */
export function MetricCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
    </Card>
  );
}

/** Dashboard: a card that will hold a chart. */
export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={`p-6 ${className ?? ""}`}>
      <Skeleton className="h-5 w-36 mb-4" />
      <Skeleton className="h-64 w-full" />
    </Card>
  );
}

/** A list of rows: title + subtitle on the left, badges on the right. Used on many pages. */
export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-border flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Projects page: timeline card + table. */
export function ProjectsListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      <Card className="p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 flex-1" />
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="hidden sm:table-cell">Progress</TableHead>
              <TableHead className="hidden md:table-cell">Due Date</TableHead>
              <TableHead className="hidden lg:table-cell">Client</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-56" />
                </TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell className="hidden sm:table-cell"><Skeleton className="h-2 w-24" /></TableCell>
                <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
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
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <Skeleton className="h-4 w-28" />
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <ListRowsSkeleton rows={3} />
      </Card>
      <Card className="p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <ListRowsSkeleton rows={3} />
      </Card>
    </div>
  );
}

/** Project detail page: header, 4 summary cards, tabs and a list. */
export function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>
      <Skeleton className="h-9 w-72" />
      <Card className="p-6">
        <Skeleton className="h-5 w-36 mb-4" />
        <ListRowsSkeleton rows={4} />
      </Card>
    </div>
  );
}

/** Single phase page. */
export function PhaseDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Skeleton className="h-4 w-40" />
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-4 w-4 mt-1.5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-2 w-full" />
      </Card>
      <Card className="p-6">
        <Skeleton className="h-5 w-32 mb-4" />
        <ListRowsSkeleton rows={4} />
      </Card>
    </div>
  );
}

/** A settings-style card with a few form fields. */
export function FormCardSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card className="p-6 space-y-4">
      <Skeleton className="h-5 w-32" />
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-24" />
    </Card>
  );
}

/** Whole-page placeholder shown while the login session is being checked. */
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen w-full flex bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 px-4 md:px-8 border-b border-border flex items-center">
          <div className="flex-1" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)}
          </div>
          <Card className="p-6"><ListRowsSkeleton rows={4} /></Card>
        </main>
      </div>
    </div>
  );
}