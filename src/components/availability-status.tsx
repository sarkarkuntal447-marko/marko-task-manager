import { cn } from "@/lib/utils";
import { availabilityIcon, availabilityLabel } from "@/lib/format";

/** The status icon from /public/statuses for an availability value. */
export function AvailabilityIcon({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  return (
    <img
      src={availabilityIcon(value)}
      alt={availabilityLabel(value) || "Available"}
      title={availabilityLabel(value) || "Available"}
      className={cn("h-4 w-4 shrink-0 select-none", className)}
      draggable={false}
    />
  );
}

/** Wraps an avatar and pins the status icon to its bottom-left edge. */
export function WithStatus({
  value,
  children,
  size = "sm",
}: {
  value?: string | null;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <span className="relative inline-flex shrink-0">
      {children}
      <span className="absolute -bottom-0.5 -left-0.5 rounded-full bg-card p-[2px]">
        <AvailabilityIcon value={value} className={size === "md" ? "h-4 w-4" : "h-3 w-3"} />
      </span>
    </span>
  );
}
