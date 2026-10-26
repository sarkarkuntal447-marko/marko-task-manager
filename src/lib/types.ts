// Shared document shapes for the MongoDB collections (replaces the generated Supabase types).
export type AppRole = "super_admin" | "admin" | "moderator" | "developer";
export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "pending" | "in_progress" | "blocked" | "testing" | "completed";
export type PhaseStatus = "not_started" | "in_progress" | "completed" | "blocked";
export type Availability = "available" | "busy" | "on_leave";
export type ProjectStatus =
  | "planning" | "requirement_gathering" | "design" | "development" | "api_integration"
  | "crm_integration" | "testing" | "deployment" | "client_review" | "live" | "in_progress"
  | "maintenance" | "completed" | "on_hold" | "cancelled";

export interface UserDoc { id: string; email: string; password_hash: string; created_at: string }
export interface ProfileDoc {
  id: string; email: string; full_name: string | null; avatar_url: string | null;
  designation: string | null; department: string | null; phone: string | null;
  joining_date: string | null; skills: string[] | null; availability: Availability;
  created_at: string; updated_at: string;
}
export interface UserRoleDoc { id: string; user_id: string; role: AppRole; created_at: string }
export interface ProjectDoc {
  id: string; name: string; description: string | null; client_name: string | null;
  client_company: string | null; client_email: string | null; client_phone: string | null;
  start_date: string | null; expected_delivery_date: string | null; actual_delivery_date: string | null;
  status: ProjectStatus; priority: Priority; technology_stack: string[] | null; progress: number;
  notes: string | null; created_by: string | null; lead_id: string | null; maintainer_id: string | null;
  created_at: string; updated_at: string; archived_at?: string | null;
}
export interface SubPhaseDoc {
  id: string; name: string; completed: boolean; created_at: string;
  start_date?: string | null; end_date?: string | null;
}
export interface PhaseDoc {
  sub_phases?: SubPhaseDoc[];
  id: string; project_id: string; name: string; assigned_to: string | null;
  start_date: string | null; end_date: string | null; status: PhaseStatus; notes: string | null;
  position: number; completed: boolean; created_at: string; updated_at: string;
}
export interface TaskDoc {
  id: string; project_id: string | null; name: string; description: string | null;
  assigned_to: string | null; due_date: string | null; priority: Priority; status: TaskStatus;
  phase_id?: string | null;
  estimated_hours: number | null; actual_hours: number | null; notes: string | null;
  created_by: string | null; created_at: string; updated_at: string;
}
export interface DailyLogDoc {
  id: string; user_id: string; project_id: string | null; task_id: string | null;
  log_date: string; task_name: string; priority: Priority; status: TaskStatus;
  hours: number | null; notes: string | null; created_at: string; updated_at: string;
}
export interface ProjectMemberDoc { id: string; project_id: string; user_id: string; created_at: string }
export interface ActivityDoc {
  id: string; actor_id: string | null; actor_name: string | null; action: string;
  entity_type: string; entity_id: string | null; entity_name: string | null;
  metadata: Record<string, unknown> | null; created_at: string;
}