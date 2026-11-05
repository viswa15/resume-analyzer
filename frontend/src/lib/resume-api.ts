export type User = {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
};

export type WorkExperience = {
  role: string;
  company: string;
  duration: string;
  description: string[];
};

export type Resume = {
  id: number;
  file_name: string;
  resume_text: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  summary: string | null;
  work_experience: WorkExperience[];
  education: { degree: string; institution: string; graduation_year: string | number }[];
  technical_skills: string[];
  soft_skills: string[];
  projects: { name: string; description: string; technologies: string[] }[];
  certifications: string[];
  resume_rating: number;
  improvement_areas: string;
  upskill_suggestions: string[];
  uploaded_at: string;
};

export type ResumeListItem = Pick<
  Resume,
  "id" | "file_name" | "name" | "email" | "uploaded_at" | "resume_rating"
>;

export type Pagination = { page: number; limit: number; total: number; totalPages: number };
export type ChatMessage = { id: number | string; role: "user" | "assistant"; content: string; created_at: string };
export type MatchResult = {
  match_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  ats_issues: string[];
  summary: string;
  recommendation: string;
};
export type RewriteResult = { rewritten: string; alternatives: string[]; why: string };
export type ExperienceRequirement = { min: number | null; max: number | null; approximate: boolean };
export type ExperienceFitTier = "good" | "unknown" | "overqualified" | "underqualified";
export type EmploymentType = "full_time" | "part_time" | "contract" | "permanent";
export type JobMatch = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: string | null;
  category: string | null;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  experienceRequirement: ExperienceRequirement | null;
  experienceFit: { tier: ExperienceFitTier };
  contractTime: "full_time" | "part_time" | null;
  contractType: "permanent" | "contract" | null;
};
export type JobSearchFilters = {
  what?: string | undefined;
  where?: string | undefined;
  maxDaysOld?: number | undefined;
  salaryMin?: number | undefined;
  salaryMax?: number | undefined;
  employmentType?: EmploymentType | undefined;
  // Optional - omit it entirely to search without ranking against any
  // resume (e.g. searching on someone else's behalf). Set it to opt into
  // ranking by experience-fit/skill-match against that resume.
  resumeId?: string | undefined;
};
export type CoverLetterTone = "professional" | "enthusiastic" | "concise";
export type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";
export type Application = {
  id: number;
  user_id: number;
  resume_id: number | null;
  company: string;
  role_title: string;
  job_url: string | null;
  status: ApplicationStatus;
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AtsCheckStatus = "pass" | "warn" | "fail";
export type AtsCheck = { id: string; label: string; status: AtsCheckStatus; detail: string };
export type AtsReport = {
  score: number;
  grade: string;
  checks: AtsCheck[];
  keywordCoverage: { requested: number; matched: string[]; missing: string[]; percent: number | null } | null;
  stats: { wordCount: number; bulletCount: number; sectionsFound: string[] };
};

export type InsightsData = {
  resumeRatings: { id: number; file_name: string; uploaded_at: string; resume_rating: number }[];
  matchHistory: { id: number; resume_id: number; file_name: string; match_score: number; job_snippet: string | null; created_at: string }[];
  topMissingKeywords: { keyword: string; count: number }[];
  applications: {
    byStatus: Record<ApplicationStatus, number>;
    total: number;
    submitted: number;
    responseRate: number | null;
    interviewRate: number | null;
    offerRate: number | null;
    weekly: { week: string; count: number }[];
  };
};

export type TailoredDocument = {
  contact: { name: string; email: string; phone: string; linkedin: string; portfolio: string };
  headline: string;
  summary: string;
  skills: string[];
  work_experience: { role: string; company: string; duration: string; bullets: string[] }[];
  education: { degree: string; institution: string; year: string }[];
  projects: { name: string; description: string; technologies: string[] }[];
  certifications: string[];
  changes?: string[];
};
export type TailorSide = { atsScore: number; keywordPercent: number | null; missingKeywords: string[] };
export type TailorResult = { document: TailoredDocument; comparison: { before: TailorSide; after: TailorSide } };

// Baked in at build time; vite.config.ts fails a production build without it,
// so the localhost fallback only ever applies in local dev.
const API_BASE_URL = (
  import.meta.env["VITE_API_BASE_URL"] || (import.meta.env.DEV ? "http://localhost:3001" : "")
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function token() {
  return typeof window === "undefined" ? null : window.localStorage.getItem("resume_analyzer_token");
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { error?: string; details?: unknown };
  if (!response.ok) {
    throw new ApiError(body.error || "Something went wrong. Please try again.", response.status, body.details);
  }
  return body as T;
}

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const authToken = token();
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const response = await fetch(`${API_BASE_URL}/api${path}`, { ...init, headers });
  return parseResponse<T>(response);
}

export const api = {
  login: (body: { email: string; password: string }) => request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  register: (body: { email: string; password: string; name?: string }) => request<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  me: () => request<User>("/auth/me"),
  upload: (file: File) => { const body = new FormData(); body.append("resume", file); return request<Resume>("/resumes/upload", { method: "POST", body }); },
  listResumes: (page: number, limit: number, q: string) => request<{ data: ResumeListItem[]; pagination: Pagination }>(`/resumes?page=${page}&limit=${limit}&q=${encodeURIComponent(q)}`),
  getResume: (id: string) => request<Resume>(`/resumes/${id}`),
  deleteResume: (id: string) => request<void>(`/resumes/${id}`, { method: "DELETE" }),
  match: (id: string, jobDescription: string) => request<MatchResult>(`/resumes/${id}/match`, { method: "POST", body: JSON.stringify({ jobDescription }) }),
  getChat: (id: string) => request<ChatMessage[]>(`/resumes/${id}/chat`),
  sendChat: (id: string, question: string) => request<{ answer: string }>(`/resumes/${id}/chat`, { method: "POST", body: JSON.stringify({ question }) }),
  rewrite: (bullet: string, role?: string) => request<RewriteResult>("/resumes/rewrite", { method: "POST", body: JSON.stringify({ bullet, role }) }),
  // Resume-optional job search: omit `resumeId` for a plain, unranked
  // search (the default - useful when searching on someone else's behalf),
  // or pass it to rank results by experience-fit/skill-match against that
  // resume.
  getJobMatches: (filters: JobSearchFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.what) params.set("what", filters.what);
    if (filters.where) params.set("where", filters.where);
    if (filters.maxDaysOld) params.set("maxDaysOld", String(filters.maxDaysOld));
    if (filters.salaryMin) params.set("salaryMin", String(filters.salaryMin));
    if (filters.salaryMax) params.set("salaryMax", String(filters.salaryMax));
    if (filters.employmentType) params.set("employmentType", filters.employmentType);
    if (filters.resumeId) params.set("resumeId", filters.resumeId);
    const qs = params.toString();
    return request<{ data: JobMatch[]; candidateExperienceYears: number | null; matchedResumeId: number | null }>(`/jobs/search${qs ? `?${qs}` : ""}`);
  },
  generateCoverLetter: (id: string, jobDescription: string, companyName?: string, tone?: CoverLetterTone) => request<{ coverLetter: string }>(`/resumes/${id}/cover-letter`, { method: "POST", body: JSON.stringify({ jobDescription, companyName, tone }) }),
  atsCheck: (id: string, jobDescription?: string) => request<AtsReport>(`/resumes/${id}/ats`, { method: "POST", body: JSON.stringify(jobDescription ? { jobDescription } : {}) }),
  // Streams a chat answer over Server-Sent Events: onDelta fires for each piece of
  // text as it arrives, and the promise resolves with the complete (saved) answer.
  streamChat: async (id: string, question: string, onDelta: (text: string) => void, signal?: AbortSignal): Promise<string> => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const authToken = token();
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    const response = await fetch(`${API_BASE_URL}/api/resumes/${id}/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ question }),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) return parseResponse<string>(response);
    if (!response.body) throw new ApiError("Streaming isn't supported in this browser.", 500);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer: string | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        let event = "message";
        let data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        const payload = JSON.parse(data) as { delta?: string; answer?: string; error?: string };
        if (event === "error") throw new ApiError(payload.error || "The assistant could not finish that answer.", 500);
        if (event === "done") answer = payload.answer ?? "";
        else if (payload.delta) onDelta(payload.delta);
      }
      if (done) break;
    }
    if (answer === null) throw new ApiError("The answer was cut off before it finished. Please try again.", 502);
    return answer;
  },
  tailorResume: (id: string, jobDescription: string) => request<TailorResult>(`/resumes/${id}/tailor`, { method: "POST", body: JSON.stringify({ jobDescription }) }),
  downloadTailoredPdf: async (id: string, document: TailoredDocument): Promise<Blob> => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const authToken = token();
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    const response = await fetch(`${API_BASE_URL}/api/resumes/${id}/tailor/pdf`, { method: "POST", headers, body: JSON.stringify({ document }) });
    if (!response.ok) return parseResponse<Blob>(response);
    return response.blob();
  },
  insights: () => request<InsightsData>("/insights"),
  listApplications: (status?: ApplicationStatus | "") => request<{ data: Application[] }>(`/applications${status ? `?status=${status}` : ""}`),
  createApplication: (body: { company: string; roleTitle: string; jobUrl?: string | undefined; status?: ApplicationStatus | undefined; notes?: string | undefined; appliedAt?: string | undefined; resumeId?: string | number | undefined }) => request<Application>("/applications", { method: "POST", body: JSON.stringify(body) }),
  updateApplication: (id: number, body: Partial<{ company: string; roleTitle: string; jobUrl: string; status: ApplicationStatus; notes: string; appliedAt: string }>) => request<Application>(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteApplication: (id: number) => request<void>(`/applications/${id}`, { method: "DELETE" }),
};

export { API_BASE_URL };