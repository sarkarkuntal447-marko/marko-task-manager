// Shared document shapes for the MongoDB collections (replaces the generated Supabase types).
import type { ProjectStatus, ProjectType } from "./project-status";
export type { ProjectStatus, ProjectType } from "./project-status";
export type AppRole = "Super_Admin" | "Admin" | "SEO" | "Developer";
// Highest first, the order they are offered in.
export const PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const TASK_STATUSES = ["completed", "in_progress", "not_started", "blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
/** Tasks still to be finished; these show under a project's Ongoing Tasks. */
export const ONGOING_TASK_STATUSES: readonly TaskStatus[] = ["not_started", "in_progress"];
export type PhaseStatus = "not_started" | "in_progress" | "completed" | "blocked";
export const AVAILABILITY = ["available", "busy", "focus", "wfh", "on_leave"] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const DEPARTMENTS = ["Tech", "SEO", "Tech & SEO"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export interface UserDoc {
  id: string;
  email: string;
  password_hash: string;
  /** false = disabled by an admin (cannot sign in). Missing means active. */
  active?: boolean;
  /** Unix seconds of the last password change; sessions signed before it are rejected. */
  password_changed_at?: number;
  created_at: string;
}
export interface ProfileDoc {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  designation: string | null;
  department: string | null;
  phone: string | null;
  joining_date: string | null;
  skills: string[] | null;
  availability: Availability;
  created_at: string;
  updated_at: string;
}
export interface UserRoleDoc {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}
export interface ProjectDoc {
  id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  client_company: string | null;
  client_email: string | null;
  client_phone: string | null;
  start_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  /** Tech or SEO. Missing on projects saved before types existed (treated as Tech). */
  project_type: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  technology_stack: string[] | null;
  progress: number;
  notes: string | null;
  created_by: string | null;
  /** Single-threaded owner. */
  lead_id: string | null;
  created_at: string;
  updated_at: string;
  /** Projects can no longer be archived; ones archived earlier stay hidden. */
  archived_at?: string | null;
}
export interface PhaseDoc {
  id: string;
  project_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: PhaseStatus;
  notes: string | null;
  position: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}
/** One line of a person's daily work log. Tasks are not linked to phases. */
export interface TaskDoc {
  id: string;
  /** The day the work is logged for (YYYY-MM-DD). */
  task_date: string;
  /** Null only when the project was removed later. */
  project_id: string | null;
  /** The task itself (free text, may span several lines). */
  name: string;
  /** Whose task this is: the person who logged it. Null if that account was deleted. */
  assigned_to: string | null;
  priority: Priority;
  status: TaskStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface DailyLogDoc {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  log_date: string;
  task_name: string;
  priority: Priority;
  status: TaskStatus;
  hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface ProjectMemberDoc {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
}
export interface ActivityDoc {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
