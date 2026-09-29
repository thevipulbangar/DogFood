export type Team = {
  id: number;
  event_id: number;
  name: string;
  invite_code: string;
  created_by: number;
  event_name: string;
  submission_deadline: string;
  event_tracks: string[];
  created_at: string;
};
export type TeamMember = { id: number; name: string; email: string };
export type Submission = {
  id: number;
  team_id: number;
  title: string | null;
  description: string | null;
  track: string | null;
  repo_url: string | null;
  demo_url: string | null;
  is_draft: boolean;
  submitted_at: string | null;
};
export type MyTeamResponse = { team: Team | null; members: TeamMember[]; submission: Submission | null };
export type EventItem = {
  id: number; name: string; description: string | null;
  start_date: string | null; end_date: string | null; submission_deadline: string;
  tracks: string[]; prizes: string | null; created_at: string;
};
export type TeamWithDetail = Team & { members: TeamMember[]; submission: Submission | null };

export type GalleryItem = {
  id: number; title: string | null; description: string | null; track: string | null;
  repo_url: string | null; demo_url: string | null; submitted_at: string | null; team_name: string;
};
export type GalleryDetail = GalleryItem & { event_id: number; event_name: string; members: { id: number; name: string }[] };

export type ManagedUser = { id: number; name: string; email: string; role: "participant" | "judge" | "organizer" | "admin"; created_at: string };

export type RubricCriterion = { id: number; event_id: number; name: string; description: string | null; weight: number };
export type JudgeAssignment = {
  id: number; status: "pending" | "completed"; assigned_at: string;
  submission_id: number; title: string | null; description: string | null;
  track: string | null; repo_url: string | null; demo_url: string | null;
};
export type ScoreInput = { criterion_id: number; raw_score: number; notes?: string };
export type ResultRow = { submission_id: number; title: string; team_name: string; judges_completed: number; raw_avg: number; normalized_avg: number; fully_normalized: boolean };

export type VotingFeedItem = {
  id: number; title: string | null; description: string | null; track: string | null;
  repo_url: string | null; demo_url: string | null; team_name: string; has_voted: boolean;
};
export type Comment = { id: number; body: string; created_at: string; author_name: string; author_role: string };
export type VotingResultRow = { submission_id: number; title: string; team_name: string; vote_count: number };
export type AuditEntry = { id: number; action: string; object: string | null; metadata: unknown; created_at: string; actor_name: string | null; actor_role: string | null };

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken() {
  try { return localStorage.getItem("dogfood.token"); } catch { return null; }
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `request failed: ${res.status}`);
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  signup: (name: string, email: string, password: string) =>
    request("/api/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  forgotPassword: (email: string) =>
    request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
  getEvents: (): Promise<EventItem[]> => request("/api/events"),
  createEvent: (event: {
    name: string; description?: string; start_date?: string; end_date?: string;
    submission_deadline: string; tracks?: string[]; prizes?: string;
  }): Promise<EventItem> => request("/api/events", { method: "POST", body: JSON.stringify(event) }),
  updateEvent: (id: number, event: Partial<{
    name: string; description: string; start_date: string; end_date: string;
    submission_deadline: string; tracks: string[]; prizes: string;
  }>): Promise<EventItem> => request(`/api/events/${id}`, { method: "PUT", body: JSON.stringify(event) }),
  getTeams: (event_id?: number): Promise<TeamWithDetail[]> =>
    request(`/api/teams${event_id ? `?event_id=${event_id}` : ""}`),
  getMyTeam: (): Promise<MyTeamResponse> => request("/api/teams/me"),
  createTeam: (event_id: number, name: string) =>
    request("/api/teams", { method: "POST", body: JSON.stringify({ event_id, name }) }),
  joinTeam: (code: string) =>
    request("/api/teams/join", { method: "POST", body: JSON.stringify({ code }) }),
  createSubmission: (team_id: number, fields: Record<string, unknown>) =>
    request("/api/submissions", { method: "POST", body: JSON.stringify({ team_id, ...fields }) }),
  updateSubmission: (id: number, fields: Record<string, unknown>) =>
    request(`/api/submissions/${id}`, { method: "PUT", body: JSON.stringify(fields) }),
  submitSubmission: (id: number) =>
    request(`/api/submissions/${id}/submit`, { method: "POST" }),
  getStats: (): Promise<{ events: number; teams: number; submissions: number }> => request("/api/stats"),
  getGallery: (params?: { q?: string; track?: string }): Promise<GalleryItem[]> => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request(`/api/gallery${qs ? `?${qs}` : ""}`);
  },
  getGalleryItem: (id: number): Promise<GalleryDetail> => request(`/api/gallery/${id}`),

  // ── Admin: account creation (judges/organizers only — there is one
  // hardcoded admin, never created here) ──────────────────────────────
  getUsers: (role?: "judge" | "organizer" | "participant" | "admin"): Promise<ManagedUser[]> =>
    request(`/api/users${role ? `?role=${role}` : ""}`),
  createUser: (name: string, email: string, password: string, role: "judge" | "organizer"): Promise<ManagedUser> =>
    request("/api/users", { method: "POST", body: JSON.stringify({ name, email, password, role }) }),
  deleteUser: (id: number) => request(`/api/users/${id}`, { method: "DELETE" }),

  // ── T2: judging ──────────────────────────────────────────────────────
  getRubric: (event_id: number): Promise<RubricCriterion[]> =>
    request(`/api/judging/rubric?event_id=${event_id}`),
  setRubric: (event_id: number, criteria: { name: string; description?: string; weight: number }[]) =>
    request("/api/judging/rubric", { method: "POST", body: JSON.stringify({ event_id, criteria }) }),
  assignJudges: (event_id: number, judges_per_submission = 3) =>
    request("/api/judging/assign", { method: "POST", body: JSON.stringify({ event_id, judges_per_submission }) }),
  getAssignments: (event_id: number) =>
    request(`/api/judging/assignments?event_id=${event_id}`),
  getMyAssignments: (): Promise<JudgeAssignment[]> => request("/api/judging/my-assignments"),
  getAssignment: (id: number) => request(`/api/judging/assignments/${id}`),
  saveScores: (assignmentId: number, scores: ScoreInput[]) =>
    request(`/api/judging/assignments/${assignmentId}/scores`, { method: "POST", body: JSON.stringify({ scores }) }),
  completeAssignment: (assignmentId: number) =>
    request(`/api/judging/assignments/${assignmentId}/complete`, { method: "POST" }),
  getResults: (event_id: number): Promise<ResultRow[]> =>
    request(`/api/judging/results?event_id=${event_id}`),
  // Browser <a href> downloads can't attach the Authorization header, so
  // CSV export fetches the file with the token attached and triggers the
  // download client-side instead of linking straight to the API.
  downloadCsv: async (event_id: number, type: "results" | "assignments" | "scores") => {
    const token = getToken();
    const res = await fetch(`${BASE}/api/judging/export.csv?event_id=${event_id}&type=${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`export failed: ${res.status}`);
    const text = await res.text();
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${type}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── T3: public voting, comments, audit trail ────────────────────────
  getVotingFeed: (event_id: number): Promise<VotingFeedItem[]> => request(`/api/voting/feed?event_id=${event_id}`),
  castVote: (submissionId: number) => request(`/api/voting/${submissionId}/vote`, { method: "POST" }),
  getComments: (submissionId: number): Promise<Comment[]> => request(`/api/voting/${submissionId}/comments`),
  postComment: (submissionId: number, body: string): Promise<Comment> =>
    request(`/api/voting/${submissionId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  getVotingResults: (event_id: number): Promise<{ published: boolean; results: VotingResultRow[] }> =>
    request(`/api/voting/results?event_id=${event_id}`),
  publishResults: (event_id: number, published = true) =>
    request("/api/voting/publish", { method: "POST", body: JSON.stringify({ event_id, published }) }),
  getAuditLog: (limit = 100): Promise<AuditEntry[]> => request(`/api/audit?limit=${limit}`),
};