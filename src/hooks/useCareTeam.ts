import { supabase } from "@/integrations/supabase/client";

export type CareProfessionalType = "dietitian" | "fitness_coach" | "wellness_coach";
export type CareAssignmentType = "fitness_coaching" | "nutrition_guidance" | "integrated_care";
export type CareConsentScope =
  | "macros"
  | "weight"
  | "hydration"
  | "meal_adherence"
  | "workouts"
  | "health_context"
  | "labs"
  | "meal_response"
  | "messages";

export interface VerifiedCareProfessional {
  professional_id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  specialties: string[];
  professional_type: CareProfessionalType;
  display_title: string;
  scope_statement: string;
  languages: string[];
  verification_expires_on: string;
  accepting_clients: boolean;
  client_count: number;
  average_rating: number;
  review_count: number;
}

export interface CareAssignment {
  id: string;
  coach_id: string;
  client_id: string | null;
  status: "pending" | "active" | "revoked";
  invite_code: string | null;
  assignment_type: CareAssignmentType;
  consent_scopes: CareConsentScope[];
  consent_version: string;
  accepted_at: string | null;
  ended_at: string | null;
  response_due_at: string | null;
  scope_statement_snapshot: string | null;
}

type RpcResult<T> = Promise<{
  data: T | null;
  error: { message: string; code?: string } | null;
}>;

type CareRpc = <T>(name: string, args?: Record<string, unknown>) => RpcResult<T>;
const rpc = supabase.rpc as unknown as CareRpc;

async function callCareRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc<T>(name, args);
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(`Care Team request returned no data: ${name}`);
  return data;
}

export async function listVerifiedCareProfessionals(): Promise<VerifiedCareProfessional[]> {
  return callCareRpc<VerifiedCareProfessional[]>("list_verified_care_professionals");
}

export async function submitCareProfessionalApplication(input: {
  professionalType: CareProfessionalType;
  bio: string;
  specialties: string[];
  qualifications: string;
  licenseAuthority: string;
  licenseNumber: string;
  licenseJurisdiction: string;
  licenseExpiresOn: string;
  requestedScope: string;
  languages: string[];
  credentialDocumentPath?: string | null;
}): Promise<string> {
  return callCareRpc<string>("submit_care_professional_application", {
    p_professional_type: input.professionalType,
    p_bio: input.bio,
    p_specialties: input.specialties,
    p_qualifications: input.qualifications,
    p_license_authority: input.licenseAuthority,
    p_license_number: input.licenseNumber,
    p_license_jurisdiction: input.licenseJurisdiction,
    p_license_expires_on: input.licenseExpiresOn,
    p_requested_scope: input.requestedScope,
    p_languages: input.languages,
    p_credential_document_path: input.credentialDocumentPath ?? null,
  });
}

export async function reviewCareProfessionalApplication(input: {
  applicationId: string;
  decision: "approved" | "needs_info" | "rejected";
  displayTitle: string;
  scopeStatement: string;
  allowedActions: string[];
  adminNote: string;
  responseSlaMinutes?: number;
  escalationSlaMinutes?: number;
}): Promise<{ status: string; credential_id: string | null }> {
  return callCareRpc("admin_review_care_professional_application", {
    p_application_id: input.applicationId,
    p_decision: input.decision,
    p_display_title: input.displayTitle,
    p_scope_statement: input.scopeStatement,
    p_allowed_actions: input.allowedActions,
    p_admin_note: input.adminNote,
    p_response_sla_minutes: input.responseSlaMinutes ?? 1440,
    p_escalation_sla_minutes: input.escalationSlaMinutes ?? 2880,
  });
}

export async function requestCareProfessional(input: {
  professionalId: string;
  assignmentType: CareAssignmentType;
  consentScopes: CareConsentScope[];
  requestId?: string;
}): Promise<{ assignment_id: string; status: string; response_due_at: string | null }> {
  return callCareRpc("request_care_professional", {
    p_professional_id: input.professionalId,
    p_assignment_type: input.assignmentType,
    p_consent_scopes: input.consentScopes,
    p_request_id: input.requestId ?? crypto.randomUUID(),
  });
}

export async function createCareInvite(input: {
  assignmentType: CareAssignmentType;
  consentScopes: CareConsentScope[];
  clientLabel: string;
  requestId?: string;
}): Promise<{ assignment_id: string; invite_code: string; status: string }> {
  return callCareRpc("create_care_invite", {
    p_assignment_type: input.assignmentType,
    p_consent_scopes: input.consentScopes,
    p_client_label: input.clientLabel,
    p_request_id: input.requestId ?? crypto.randomUUID(),
  });
}

export async function acceptCareInvite(inviteCode: string): Promise<{
  assignment_id: string;
  professional_id: string;
  status: string;
}> {
  return callCareRpc("accept_care_invite", {
    p_invite_code: inviteCode.trim().toUpperCase(),
    p_request_id: crypto.randomUUID(),
  });
}

export async function respondCareAssignment(
  assignmentId: string,
  decision: "accept" | "decline",
): Promise<{ assignment_id: string; status: string }> {
  return callCareRpc("respond_care_assignment", {
    p_assignment_id: assignmentId,
    p_decision: decision,
  });
}

export async function endCareAssignment(assignmentId: string, reason: string): Promise<boolean> {
  return callCareRpc("end_care_assignment", {
    p_assignment_id: assignmentId,
    p_reason: reason,
  });
}

export async function getParticipantCareAssignments(filters: {
  coachId?: string;
  clientId?: string;
  statuses?: Array<CareAssignment["status"]>;
}): Promise<CareAssignment[]> {
  let query = supabase
    .from("coach_client_assignments")
    .select(
      "id, coach_id, client_id, status, invite_code, assignment_type, consent_scopes, consent_version, accepted_at, ended_at, response_due_at, scope_statement_snapshot",
    );
  if (filters.coachId) query = query.eq("coach_id", filters.coachId);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.statuses?.length) query = query.in("status", filters.statuses);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CareAssignment[];
}

export async function findActiveCareAssignment(
  coachId: string,
  clientId: string,
): Promise<CareAssignment | null> {
  const rows = await getParticipantCareAssignments({ coachId, clientId, statuses: ["active"] });
  return rows[0] ?? null;
}

export async function addCareNote(
  assignmentId: string,
  noteType: "progress" | "nutrition" | "training" | "barrier" | "safety" | "session",
  note: string,
) {
  return callCareRpc<Record<string, unknown>>("add_care_note", {
    p_assignment_id: assignmentId,
    p_note_type: noteType,
    p_note: note,
  });
}

export async function amendCareNote(noteId: string, note: string) {
  return callCareRpc<Record<string, unknown>>("amend_care_note", {
    p_note_id: noteId,
    p_note: note,
  });
}

export async function archiveCareNote(noteId: string): Promise<boolean> {
  return callCareRpc("archive_care_note", { p_note_id: noteId });
}

export async function createCareSession(input: {
  assignmentId: string;
  title: string;
  description?: string | null;
  sessionType?: string;
  scheduledAt: string;
  durationMinutes?: number;
  notes?: string | null;
  requestId?: string;
}) {
  return callCareRpc<Record<string, unknown>>("create_care_session", {
    p_assignment_id: input.assignmentId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_session_type: input.sessionType ?? "video_call",
    p_scheduled_at: input.scheduledAt,
    p_duration_minutes: input.durationMinutes ?? 30,
    p_notes: input.notes ?? null,
    p_request_id: input.requestId ?? crypto.randomUUID(),
  });
}

export async function updateCareSession(input: {
  sessionId: string;
  status?: string | null;
  title?: string | null;
  description?: string | null;
  meetingLink?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
}) {
  return callCareRpc<Record<string, unknown>>("update_care_session", {
    p_session_id: input.sessionId,
    p_status: input.status ?? null,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_meeting_link: input.meetingLink ?? null,
    p_notes: input.notes ?? null,
    p_cancellation_reason: input.cancellationReason ?? null,
  });
}

export async function reviewCarePlan(input: {
  assignmentId: string;
  planKind: "nutrition_goal" | "meal_plan" | "training_plan" | "health_program";
  sourceEntityId?: string | null;
  planVersion: number;
  planSnapshot: Record<string, unknown>;
  decision: "approved" | "changes_required" | "outside_scope";
  rationale: string;
  requestId?: string;
}) {
  return callCareRpc<Record<string, unknown>>("review_care_plan", {
    p_assignment_id: input.assignmentId,
    p_plan_kind: input.planKind,
    p_source_entity_id: input.sourceEntityId ?? null,
    p_plan_version: input.planVersion,
    p_plan_snapshot: input.planSnapshot,
    p_decision: input.decision,
    p_rationale: input.rationale,
    p_request_id: input.requestId ?? crypto.randomUUID(),
  });
}

export async function openCareEscalation(input: {
  assignmentId: string;
  category: "response_overdue" | "scope_question" | "safety_concern" | "service_issue" | "handoff_required";
  severity: "normal" | "high" | "urgent";
  summary: string;
}): Promise<string> {
  return callCareRpc("open_care_escalation", {
    p_assignment_id: input.assignmentId,
    p_category: input.category,
    p_severity: input.severity,
    p_summary: input.summary,
  });
}

export async function resolveCareEscalation(
  escalationId: string,
  action: "acknowledge" | "resolve" | "cancel",
  resolution?: string | null,
): Promise<boolean> {
  return callCareRpc("resolve_care_escalation", {
    p_escalation_id: escalationId,
    p_action: action,
    p_resolution: resolution ?? null,
  });
}

export async function getCareAssignmentWorkspace(assignmentId: string): Promise<{
  assignment: CareAssignment;
  reviews: Array<{
    id: string;
    plan_kind: string;
    plan_version: number;
    decision: string;
    rationale: string;
    reviewed_at: string;
    acknowledged_at: string | null;
  }>;
  escalations: Array<{
    id: string;
    category: string;
    severity: string;
    status: string;
    summary: string;
    due_at: string;
    resolution: string | null;
  }>;
}> {
  return callCareRpc("get_care_assignment_workspace", { p_assignment_id: assignmentId });
}
