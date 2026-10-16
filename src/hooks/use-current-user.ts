import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/app.functions";
import type { AppRole } from "@/lib/types";

export type { AppRole };

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: () => getSession(),
    staleTime: 60_000,
  });
}

export function canManageProjects(role?: AppRole) {
  return role === "super_admin" || role === "admin";
}
export function canAssignTasks(role?: AppRole) {
  return role === "super_admin" || role === "admin" || role === "moderator";
}
