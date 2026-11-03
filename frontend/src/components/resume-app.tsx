import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUp, Bot, ChartLine, ScanSearch, BookOpen, BriefcaseBusiness, Building2, Check, ChevronLeft, ChevronRight, ClipboardList, Copy, DollarSign, Eye, EyeOff, ExternalLink, FileText, Filter, History, ListChecks, LogOut, Mail, MapPin, MessageCircle, Milestone, Plus, Search, Send, Sparkles, Trash2, Upload, WandSparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { api, type Application, type ApplicationStatus, type ChatMessage, type CoverLetterTone, type EmploymentType, type JobMatch, type MatchResult, type Resume, type ResumeListItem, type RewriteResult, type User } from "../lib/resume-api";
import { useApiAction } from "../lib/use-api-action";
import { useAuth } from "../lib/auth";
import { byRichnessThenOriginal, getResumeContentProfile, type SectionRichness } from "../lib/content-profile";

export const panel = "rounded-xl border border-border/60 bg-panel/80";
export const quietButton = "border-border/80 bg-transparent text-muted-foreground hover:bg-raise hover:text-foreground";

// --- Score gauge -----------------------------------------------------------
// A circular progress ring used everywhere a score/rating is the headline
// number (resume rating, ATS score, JD match score). Replaces the old flat
// number + linear bar with something that reads as a dashboard, not a report.
type GaugeTone = "good" | "warn" | "bad";

function gaugeTone(percent: number): GaugeTone {
  if (percent >= 70) return "good";
  if (percent >= 40) return "warn";
  return "bad";
}

const GAUGE_STROKE: Record<GaugeTone, string> = {
  good: "var(--color-brass)",
  warn: "oklch(0.75 0.15 85)",
  bad: "oklch(0.62 0.18 25)",
};

export function ScoreGauge({
  value,
  max = 100,
  label,
  sublabel,
  size = 128,
  strokeWidth = 10,
  tone = "auto",
}: {
  value: number;
  max?: number;
  label?: string;
  sublabel?: React.ReactNode;
  size?: number;
  strokeWidth?: number;
  tone?: "auto" | "brass";
}) {
  const gradientId = useId();
  const clamped = Math.max(0, Math.min(value, max));
  const percent = max > 0 ? (clamped / max) * 100 : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const stroke = tone === "brass" ? `url(#${gradientId})` : GAUGE_STROKE[gaugeTone(percent)];
  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div className="score-reveal relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-brass)" />
              <stop offset="100%" stopColor="var(--color-brass-lt)" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 700ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl leading-none text-foreground">{Math.round(clamped)}</span>
          <span className="text-[11px] text-muted-foreground">/ {max}</span>
        </div>
      </div>
      {(label || sublabel) && (
        <div className="text-center">
          {label && <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>}
          {sublabel && <div className="mt-0.5 text-xs text-muted-foreground">{sublabel}</div>}
        </div>
      )}
    </div>
  );
}

// --- Mascot ------------------------------------------------------------
// A small recurring "character" (a badge around the existing Bot icon, with
// a pulsing brass status dot) used in loading and empty states so the app
// has one consistent friendly presence instead of a different bare icon
// every time.
export function Mascot({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative inline-grid shrink-0 place-items-center rounded-full border border-brass/30 bg-gradient-to-br from-brass/20 via-brass/5 to-transparent text-brass ${className}`}
      style={{ width: size, height: size }}
    >
      <Bot style={{ width: size * 0.5, height: size * 0.5 }} />
      <span className="pulse-dot absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brass shadow-[0_0_0_2px_var(--color-panel)]" />
    </div>
  );
}

// A candidate's initials in a small badge - gives the resume dossier header
// a document/identity feel instead of being purely typographic.
export function InitialsBadge({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full border border-brass/30 bg-gradient-to-br from-brass/25 via-brass/10 to-transparent font-display text-lg text-brass-lt"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, ready } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && !user && location.pathname !== "/login" && location.pathname !== "/register") void navigate({ to: "/login" });
  }, [location.pathname, navigate, ready, user]);
  if (!ready || (!user && location.pathname !== "/login" && location.pathname !== "/register")) return <div className="min-h-screen bg-background" />;
  if (!user) return <>{children}</>;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1320px]">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-6 self-start overflow-y-auto border-r border-border/60 px-5 py-6 md:flex">
          <Brand />
          <NavLinks />
          <div className="mt-auto">
            <div className={`${panel} bg-raise/60 p-3`}>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="pulse-dot size-1.5 rounded-full bg-brass" />AI engine online</div>
              <div className="mt-3 flex items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-brass/15 text-sm font-medium text-brass">{initials(user)}</div><div className="min-w-0"><div className="truncate text-sm">{user.name || "Your account"}</div><div className="truncate text-[11px] text-muted-foreground">{user.email}</div></div></div>
              <Button variant="outline" className={`mt-3 w-full ${quietButton}`} onClick={signOut}><LogOut />Sign out</Button>
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-5 py-4 backdrop-blur md:hidden"><Brand compact /><nav className="flex items-center gap-1"><Button asChild variant="outline" size="icon" className={quietButton}><Link to="/" aria-label="Analysis"><FileText className="size-4" /></Link></Button><Button asChild variant="outline" size="icon" className={quietButton}><Link to="/jobs" aria-label="Jobs"><BriefcaseBusiness className="size-4" /></Link></Button><Button asChild variant="outline" size="icon" className={quietButton}><Link to="/history" aria-label="History"><History className="size-4" /></Link></Button><Button asChild variant="outline" size="icon" className={quietButton}><Link to="/applications" aria-label="Applications"><ClipboardList className="size-4" /></Link></Button><Button asChild variant="outline" size="icon" className={quietButton}><Link to="/roadmaps" aria-label="Roadmaps"><Milestone className="size-4" /></Link></Button><Button asChild variant="outline" size="icon" className={quietButton}><Link to="/insights" aria-label="Insights"><ChartLine className="size-4" /></Link></Button><Button asChild variant="outline" size="icon" className={quietButton}><Link to="/guide" aria-label="Guide"><BookOpen className="size-4" /></Link></Button><Button variant="outline" size="icon" className={quietButton} onClick={signOut} aria-label="Sign out"><LogOut className="size-4" /></Button></nav></header>
          <main className="px-5 py-6 md:px-10 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) { return <Link to="/" className="block px-1"><div className="font-display text-[22px] leading-none text-foreground">DeepKlarity</div>{!compact && <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-brass/80">Resume Dossier</div>}</Link>; }
function NavLinks() { return <nav className="flex flex-col gap-1 text-sm"><NavItem to="/" icon={<FileText />} label="Analysis" /><NavItem to="/jobs" icon={<BriefcaseBusiness />} label="Jobs" /><NavItem to="/history" icon={<History />} label="History" /><NavItem to="/applications" icon={<ClipboardList />} label="Applications" /><NavItem to="/insights" icon={<ChartLine />} label="Insights" /><NavItem to="/roadmaps" icon={<Milestone />} label="Roadmaps" /><NavItem to="/guide" icon={<BookOpen />} label="Guide" /></nav>; }
function NavItem({ to, icon, label }: { to: "/" | "/jobs" | "/history" | "/guide" | "/applications" | "/roadmaps" | "/insights"; icon: React.ReactNode; label: string }) { return <Link to={to} activeProps={{ className: "bg-raise text-foreground ring-1 ring-border/60" }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-raise hover:text-foreground">{icon}<span>{label}</span></Link>; }
function initials(user: User) { return (user.name || user.email).split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) { return <header className="flex flex-wrap items-end justify-between gap-4"><div className="max-w-[52ch]"><div className="text-[11px] uppercase tracking-[0.2em] text-brass/80">{eyebrow}</div><h1 className="mt-2 font-display text-3xl leading-tight md:text-4xl">{title}</h1>{description && <p className="mt-2 text-base text-muted-foreground">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>; }
export function LoadingState({ label }: { label: string }) { return <div className={`${panel} flex min-h-40 items-center justify-center gap-3 p-6 text-sm text-muted-foreground`}><span className="size-4 animate-spin rounded-full border-2 border-brass/30 border-t-brass" />{label}</div>; }
export function ErrorNote({ message }: { message: string | null }) { return message ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground" role="alert">{message}</div> : null; }

function UploadPanel({ onUploaded }: { onUploaded: (resume: Resume) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const upload = useApiAction(api.upload);
  const choose = (candidate: File | undefined) => {
    setFileError(null);
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) return setFileError("Please choose a PDF resume.");
    if (candidate.size > 5 * 1024 * 1024) return setFileError("This file is over 5MB. Please choose a smaller PDF.");
    setFile(candidate);
  };
  const submit = async () => { if (!file) return setFileError("Choose a PDF before starting analysis."); try { onUploaded(await upload.run(file)); setFile(null); } catch { /* surfaced inline */ } };
  return <section className={`${panel} p-5 md:p-6`}><div className="flex items-center justify-between gap-3"><div className="font-display text-lg">New analysis</div><span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">PDF · up to 5MB</span></div><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }} className="mt-4 rounded-xl border border-dashed border-border bg-raise/40 px-6 py-9 text-center"><div className="mx-auto grid size-12 place-items-center rounded-full border border-brass/30 text-brass"><ArrowUp /></div><p className="mt-4 text-sm text-muted-foreground">{file ? file.name : "Drop a resume here, or"}</p><input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => choose(event.target.files?.[0])} /><Button variant="default" className="mt-3 rounded-full bg-brass text-primary-foreground ring-1 ring-brass/40 hover:bg-brass-lt" onClick={() => inputRef.current?.click()}>{file ? "Choose another" : "Choose file"}</Button><p className="mt-3 text-xs text-muted-foreground">We parse text, extract structure, and score it against hiring signals.</p></div><ErrorNote message={fileError || upload.error} />{file && !upload.loading && <Button className="mt-4 w-full rounded-full bg-brass text-primary-foreground hover:bg-brass-lt" onClick={submit}><Sparkles />Analyze {file.name}</Button>}{upload.loading && <div className="mt-4 rounded-lg border border-brass/25 bg-brass/10 px-4 py-3 text-sm text-brass"><span className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-brass/30 border-t-brass" />Reading your resume and building the dossier…</div>}</section>;
}

function ScoreCard({ resume }: { resume: Resume | null }) { const rating = resume?.resume_rating ?? 0; return <section className={`${panel} flex flex-col p-5 md:p-6`}><div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Overall rating</div>{resume ? <><div className="mt-4 flex items-center gap-5"><ScoreGauge value={rating} max={10} tone="brass" size={104} strokeWidth={9} /><p className="text-sm text-muted-foreground">{resume.improvement_areas || "Your structured analysis is ready to review."}</p></div><div className="mt-auto grid grid-cols-2 gap-3 pt-5"><Stat label="Sections found" value={sectionCount(resume)} /><Stat label="Uploaded" value={formatDate(resume.uploaded_at)} small /></div></> : <div className="mt-8 text-sm text-muted-foreground">Upload a resume to see its signal strength and improvement path.</div>}</section>; }
function Stat({ label, value, small = false }: { label: string; value: string | number; small?: boolean }) { return <div className="rounded-lg border border-border/60 bg-raise/50 p-3"><div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className={`${small ? "text-base" : "text-2xl"} mt-1 font-display leading-none text-foreground`}>{value}</div></div>; }
function sectionCount(resume: Resume) { return [resume.summary, resume.work_experience.length, resume.education.length, resume.technical_skills.length, resume.projects.length, resume.certifications.length].filter(Boolean).length; }

const LANDING_FEATURES: { icon: React.ReactNode; title: string; body: string }[] = [
  { icon: <FileText />, title: "Instant rating", body: "Upload a PDF and get a 1-10 rating plus a full structured breakdown in seconds." },
  { icon: <BriefcaseBusiness />, title: "JD match scoring", body: "Paste any job description and see a 0-100 match score, keyword gaps, and ATS issues." },
  { icon: <MessageCircle />, title: "Grounded chat", body: "Ask questions about your resume and get answers grounded in what you actually wrote." },
  { icon: <WandSparkles />, title: "Bullet rewrites", body: "Turn any weak bullet into a stronger one, with alternatives and the reasoning behind them." },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Brand compact />
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className={quietButton}><Link to="/login">Sign in</Link></Button>
            <Button asChild className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt"><Link to="/register">Create account</Link></Button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-10 text-center md:pt-16">
        <div className="text-[11px] uppercase tracking-[0.22em] text-brass/80">Resume intelligence</div>
        <h1 className="mt-4 font-display text-4xl leading-tight md:text-5xl">Know exactly where your resume stands, and how to make it stronger.</h1>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">Upload a PDF and get an instant rating, a job-description match score, a grounded chat assistant, and AI rewrites for every weak bullet.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt"><Link to="/register">Analyze your resume</Link></Button>
          <Button asChild size="lg" variant="outline" className={quietButton}><Link to="/guide">See how it works</Link></Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 md:grid-cols-2">
        {LANDING_FEATURES.map((feature) => (
          <div key={feature.title} className={`${panel} p-5 md:p-6`}>
            <div className="grid size-10 place-items-center rounded-full bg-brass/10 text-brass">{feature.icon}</div>
            <h2 className="mt-4 font-display text-lg">{feature.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export function HomeGate() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-screen bg-background" />;
  return user ? <AnalysisPage /> : <LandingPage />;
}

export function AnalysisPage() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [recent, setRecent] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { handleUnauthorized } = useAuth();
  useEffect(() => { api.listResumes(1, 3, "").then(async (result) => { setRecent(result.data); const first = result.data[0]; if (first) setResume(await api.getResume(String(first.id))); }).catch((error) => { if (error?.status === 401) handleUnauthorized(); }).finally(() => setLoading(false)); }, [handleUnauthorized]);
  return <AppLayout><PageHeader eyebrow="Analysis workspace" title={resume?.name ? `${resume.name}'s dossier` : "Build your resume dossier"} description={resume ? `${resume.file_name} · analyzed ${formatDate(resume.uploaded_at)}` : "Upload a resume to turn experience into a clear, actionable read."} actions={resume ? <><Button asChild variant="outline" className={quietButton}><Link to="/resumes/$id/match" params={{ id: String(resume.id) }}>JD match</Link></Button>
          <Button asChild variant="outline" className={quietButton}><Link to="/resumes/$id/ats" params={{ id: String(resume.id) }}><ScanSearch />ATS check</Link></Button><Button asChild className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt"><Link to="/resumes/$id/chat" params={{ id: String(resume.id) }}><MessageCircle />Start assistant</Link></Button></> : undefined} /><div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><UploadPanel onUploaded={(next) => { setResume(next); setRecent((items) => [next, ...items.filter((item) => item.id !== next.id)].slice(0, 3)); toast.success("Resume analysis is ready"); }} /><ScoreCard resume={resume} /></div>{loading ? <div className="mt-4"><LoadingState label="Loading your latest dossier…" /></div> : resume ? <ResumeOverview resume={resume} /> : <EmptyAnalysis />}{recent.length > 0 && <RecentUploads items={recent} onDeleted={(id) => { setRecent((items) => items.filter((item) => item.id !== id)); setResume((current) => (current?.id === id ? null : current)); }} />}</AppLayout>;
}

function EmptyAnalysis() { return <section className={`${panel} mt-4 p-6`}><div className="flex items-start gap-4"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-brass/10 text-brass"><FileText /></div><div><h2 className="font-display text-xl">Your next opportunity starts here.</h2><p className="mt-1 max-w-prose text-sm text-muted-foreground">A first analysis gives you the rating, structure, and next steps to make your resume easier to trust.</p></div></div></section>; }
function ResumeOverview({ resume }: { resume: Resume }) { return <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><section className={`${panel} p-5 md:p-6`}><div className="flex items-center justify-between"><h2 className="font-display text-lg">Experience</h2><span className="text-xs text-muted-foreground">{resume.work_experience.length} roles</span></div><div className="mt-4 space-y-3">{resume.work_experience.map((experience, index) => <ExperienceBlock key={`${experience.company}-${index}`} experience={experience} />)}</div></section><div className="flex flex-col gap-4"><InfoPanel title="Skills"><TagList items={[...resume.technical_skills, ...resume.soft_skills]} /></InfoPanel><InfoPanel title="Improving"><p className="text-sm text-muted-foreground">{resume.improvement_areas || "No improvement areas were returned."}</p></InfoPanel><InfoPanel title="Upskills"><BulletList items={resume.upskill_suggestions} /></InfoPanel></div></div>; }
function ExperienceBlock({ experience, resumeId }: { experience: Resume["work_experience"][number]; resumeId?: number }) { return <div className="rounded-xl border border-border/60 bg-raise/40 p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><div className="font-medium">{experience.role}</div><div className="text-xs text-muted-foreground">{experience.company} · {experience.duration}</div></div><ul className="mt-3 space-y-2 text-sm text-muted-foreground">{experience.description.map((bullet, index) => <BulletRewrite key={`${bullet}-${index}`} bullet={bullet} role={experience.role} />)}</ul>{resumeId && <Link className="mt-3 inline-flex text-xs text-brass hover:text-brass-lt" to="/resumes/$id" params={{ id: String(resumeId) }}>Open full dossier <ChevronRight className="ml-1 size-3" /></Link>}</div>; }
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };
  return <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" aria-label="Copy to clipboard">{copied ? <Check className="size-3" /> : <Copy className="size-3" />}</button>;
}

function BulletRewrite({ bullet, role }: { bullet: string; role: string }) { const rewrite = useApiAction(api.rewrite); const [result, setResult] = useState<RewriteResult | null>(null); const run = async () => { try { setResult(await rewrite.run(bullet, role)); } catch { /* surfaced inline */ } }; return <li className="flex flex-col gap-2"><div className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-brass/70" /><span className="flex-1">{bullet}</span></div>{result ? <div className="ml-3 border-l border-brass/30 pl-3 text-sm text-foreground"><div className="flex items-start justify-between gap-2"><div className="text-brass">{result.rewritten}</div><CopyButton text={result.rewritten} /></div>{result.alternatives.map((alternative) => <div key={alternative} className="mt-1 flex items-start justify-between gap-2 text-muted-foreground"><span>Alternative: {alternative}</span><CopyButton text={alternative} /></div>)}<div className="mt-2 text-xs text-muted-foreground">Why: {result.why}</div></div> : <div className="ml-3 flex items-center gap-2"><Button variant="outline" size="sm" className={`h-7 ${quietButton}`} onClick={run} disabled={rewrite.loading}><WandSparkles />{rewrite.loading ? "Rewriting…" : "Rewrite bullet"}</Button>{rewrite.error && <span className="text-xs text-destructive-foreground">{rewrite.error}</span>}</div>}</li>; }
function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className={`${panel} p-5`}><h2 className="font-display text-base">{title}</h2><div className="mt-3">{children}</div></section>; }
function TagList({ items }: { items: string[] }) { return items.length ? <div className="flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-full border border-border bg-raise/50 px-3 py-1 text-xs text-muted-foreground">{item}</span>)}</div> : <p className="text-sm text-muted-foreground">No skills listed.</p>; }
function BulletList({ items }: { items: string[] }) { return items.length ? <ul className="space-y-2 text-sm text-muted-foreground">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-brass/70" />{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">No suggestions returned.</p>; }
function RecentUploads({ items, onDeleted }: { items: ResumeListItem[]; onDeleted: (id: number) => void }) { return <section className={`${panel} mt-4 p-5 md:p-6`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg">Recent uploads</h2><p className="mt-1 text-sm text-muted-foreground">Your latest dossiers, most recent first.</p></div><Link to="/history" className="text-sm text-brass hover:text-brass-lt">View all history <ChevronRight className="inline size-4" /></Link></div><div className="mt-4 divide-y divide-border/60">{items.map((item) => <ResumeRow key={item.id} item={item} onDeleted={onDeleted} />)}</div></section>; }
function ResumeRow({ item, onDeleted }: { item: ResumeListItem; onDeleted: (id: number) => void }) {
  const del = useApiAction(api.deleteResume);
  const [confirming, setConfirming] = useState(false);
  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      await del.run(String(item.id));
      toast.success("Resume deleted");
      onDeleted(item.id);
    } catch {
      toast.error("Couldn't delete this resume. Try again.");
      setConfirming(false);
    }
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3 transition-colors hover:bg-raise/40 sm:grid-cols-[1.4fr_1fr_auto_auto]">
      <Link to="/resumes/$id" params={{ id: String(item.id) }} className="min-w-0">
        <div className="truncate text-sm">{item.file_name}</div>
        <div className="truncate text-xs text-muted-foreground">{item.name || "Unnamed candidate"} · {item.email || "No email"}</div>
      </Link>
      <Link to="/resumes/$id" params={{ id: String(item.id) }} className="hidden text-xs text-muted-foreground sm:block">{formatDate(item.uploaded_at)}</Link>
      <Link to="/resumes/$id" params={{ id: String(item.id) }} className="text-right font-display text-lg text-brass-lt">{item.resume_rating}<span className="text-xs text-muted-foreground">/10</span></Link>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={`size-8 shrink-0 ${confirming ? "border-destructive text-destructive hover:bg-destructive/10" : quietButton}`}
        onClick={handleDelete}
        onBlur={() => setConfirming(false)}
        disabled={del.loading}
        aria-label={confirming ? "Confirm delete resume" : "Delete resume"}
        title={confirming ? "Click again to confirm delete" : "Delete resume"}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export function HistoryPage() { const [items, setItems] = useState<ResumeListItem[]>([]); const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 }); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(true); const list = useApiAction(api.listResumes); const load = async (page: number, q = query) => { try { const result = await list.run(page, 10, q); setItems(result.data); setPagination(result.pagination); } catch { /* surfaced inline */ } }; useEffect(() => { load(1).finally(() => setLoading(false)); }, []); const handleDeleted = () => { const nextPage = items.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page; void load(nextPage); }; return <AppLayout><PageHeader eyebrow="Archive" title="Resume history" description="Search and revisit every dossier you have analyzed." /><form className="mt-6 flex max-w-xl gap-2" onSubmit={(event) => { event.preventDefault(); void load(1); }}><div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or filename" className="h-10 rounded-full border-border/70 bg-panel pl-9" /></div><Button type="submit" className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt">Search</Button></form><div className="mt-6">{list.error && <ErrorNote message={list.error} />}{loading ? <LoadingState label="Loading your archive…" /> : items.length ? <section className={`${panel} overflow-hidden`}><div className="hidden grid-cols-[1.4fr_1fr_0.8fr_auto] gap-4 border-b border-border/60 px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:grid"><span>File</span><span>Candidate</span><span>Uploaded</span><span>Rating</span></div><div className="divide-y divide-border/60">{items.map((item) => <ResumeRow key={item.id} item={item} onDeleted={handleDeleted} />)}</div><div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground"><span>{pagination.total} dossier{pagination.total === 1 ? "" : "s"}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" className={quietButton} disabled={pagination.page <= 1 || list.loading} onClick={() => void load(pagination.page - 1)} aria-label="Previous page"><ChevronLeft /></Button><span>{pagination.page} / {Math.max(1, pagination.totalPages)}</span><Button variant="outline" size="icon" className={quietButton} disabled={pagination.page >= pagination.totalPages || list.loading} onClick={() => void load(pagination.page + 1)} aria-label="Next page"><ChevronRight /></Button></div></div></section> : <EmptyHistory query={query} />}</div></AppLayout>; }
function EmptyHistory({ query }: { query: string }) { return <section className={`${panel} flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center`}><div className="grid size-12 place-items-center rounded-full border border-brass/25 text-brass"><History /></div><h2 className="mt-4 font-display text-xl">{query ? "No dossiers match that search." : "Your archive is waiting."}</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">{query ? "Try a different name, email, or filename." : "Upload your first resume to create a structured dossier you can return to anytime."}</p>{!query && <Button asChild className="mt-5 rounded-full bg-brass text-primary-foreground hover:bg-brass-lt"><Link to="/"><Upload />Analyze a resume</Link></Button>}</section>; }

const GUIDE_STEPS: { icon: React.ReactNode; title: string; body: string }[] = [
  { icon: <Upload />, title: "1. Upload your resume", body: "Drop in a PDF from the Analysis page. Within seconds you get a rating out of 10, plus a full structured breakdown: contact info, work experience, education, skills, projects, certifications, improvement areas, and upskill suggestions. This happens once per upload and never changes afterward." },
  { icon: <BriefcaseBusiness />, title: "2. Score it against a job description", body: "Open any resume's dossier and click \"JD match.\" Paste a job description (30 characters minimum) and click \"Score my resume.\" You'll get a 0-100 match score, matched and missing keywords, ATS formatting issues, a summary, and a recommendation, specific to that JD. Paste a different JD any time for a fresh score." },
  { icon: <MessageCircle />, title: "3. Ask the assistant", body: "From a dossier, click \"Assistant\" to open a chat grounded in that specific resume. Ask what to tailor for a role, which bullets need more proof, or how to prepare for an interview. It remembers the conversation as you go." },
  { icon: <WandSparkles />, title: "4. Rewrite weak bullets", body: "Inside a dossier's work experience section, click \"Rewrite bullet\" under any line. The assistant returns a stronger rewrite, a couple of alternatives, and a one-line reason why, each with a copy button so you can drop it straight into your resume file." },
  { icon: <History />, title: "5. Revisit anytime", body: "Every analyzed resume is saved to History, searchable by name, email, or filename. Open an old dossier to re-run a JD match, keep chatting, or delete it if you no longer need it." },
];

function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Brand compact />
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className={quietButton}><Link to="/login">Sign in</Link></Button>
            <Button asChild className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt"><Link to="/register">Create account</Link></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-20">{children}</main>
    </div>
  );
}

export function GuidePage() {
  const { user, ready } = useAuth();
  const content = <>
    <PageHeader eyebrow="Guide" title="How DeepKlarity works" description="Five steps from a raw PDF to a resume that's tailored, discussed, and improved." />
    <div className="mt-6 space-y-4">{GUIDE_STEPS.map((step) => <section key={step.title} className={`${panel} flex gap-4 p-5 md:p-6`}><div className="grid size-10 shrink-0 place-items-center rounded-full bg-brass/10 text-brass">{step.icon}</div><div><h2 className="font-display text-lg">{step.title}</h2><p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{step.body}</p></div></section>)}</div>
    <section className={`${panel} mt-4 p-5 md:p-6`}><h2 className="font-display text-lg">Two different scores, two different jobs</h2><p className="mt-2 max-w-prose text-sm text-muted-foreground">The <strong className="text-foreground">resume rating (out of 10)</strong> is generated once at upload and judges the resume on its own, how well-written, complete, and structured it is. The <strong className="text-foreground">JD match score (out of 100)</strong> only appears after you paste a job description, and measures how well that resume aligns with that specific role. Uploading again won't change the rating unless the resume itself changes; matching against a different JD will always give a different match score.</p></section>
  </>;
  if (!ready) return <div className="min-h-screen bg-background" />;
  return user ? <AppLayout>{content}</AppLayout> : <PublicPage>{content}</PublicPage>;
}


type LayoutMode = "classic" | "flow" | "masonry";

const LAYOUT_MODE_OPTIONS: { value: LayoutMode; label: string; hint: string }[] = [
  { value: "classic", label: "Classic", hint: "A fixed two-column layout - the same shape for every resume." },
  { value: "flow", label: "Content flow", hint: "Sections resize, reorder, and hide based on what this resume actually has." },
  { value: "masonry", label: "Masonry", hint: "Every section becomes its own card, packed by height like a waterfall." },
];

function LayoutModeToggle({ value, onChange }: { value: LayoutMode; onChange: (mode: LayoutMode) => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Layout</span>
      <div className="flex flex-wrap gap-1.5">
        {LAYOUT_MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${value === option.value ? "border-brass bg-brass/10 text-brass-lt" : "border-border/60 bg-panel text-muted-foreground hover:text-foreground"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ResumeDetailPage() {
  const { id } = useParams({ strict: false });
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("classic");
  const { handleUnauthorized } = useAuth();
  useEffect(() => {
    if (!id) return;
    api.getResume(id).then(setResume).catch((caught) => { if (caught?.status === 401) handleUnauthorized(); setError(caught instanceof Error ? caught.message : "This resume was not found."); }).finally(() => setLoading(false));
  }, [handleUnauthorized, id]);
  if (loading) return <AppLayout><LoadingState label="Loading dossier…" /></AppLayout>;
  if (error || !resume) return <AppLayout><ErrorNote message={error || "This resume was not found."} /></AppLayout>;
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Resume dossier"
        title={resume.name || resume.file_name}
        description={[resume.email, resume.phone].filter(Boolean).join(" · ") || "Structured analysis"}
        actions={<>
          <Button asChild variant="outline" className={quietButton}><Link to="/resumes/$id/match" params={{ id: String(resume.id) }}>JD match</Link></Button>
          <Button asChild variant="outline" className={quietButton}><Link to="/resumes/$id/jobs" params={{ id: String(resume.id) }}><BriefcaseBusiness />Job matches</Link></Button>
          <Button asChild variant="outline" className={quietButton}><Link to="/resumes/$id/tailor" params={{ id: String(resume.id) }}><WandSparkles />Tailor</Link></Button>
          <Button asChild variant="outline" className={quietButton}><Link to="/resumes/$id/cover-letter" params={{ id: String(resume.id) }}><Mail />Cover letter</Link></Button>
          <Button asChild className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt"><Link to="/resumes/$id/chat" params={{ id: String(resume.id) }}><MessageCircle />Assistant</Link></Button>
        </>}
      />
      <LayoutModeToggle value={layoutMode} onChange={setLayoutMode} />
      {layoutMode === "classic" && <ClassicDossierBody resume={resume} />}
      {layoutMode === "flow" && <FlowDossierBody resume={resume} />}
      {layoutMode === "masonry" && <MasonryDossierBody resume={resume} />}
    </AppLayout>
  );
}
function ScoreValue({ score }: { score: number }) { return <ScoreGauge value={score} max={10} tone="brass" label="Rating" size={104} strokeWidth={9} />; }
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="font-display text-xl">{title}</h3><div className="mt-3">{children}</div></section>; }

// The original, always-the-same-shape layout: a fixed 340px sidebar next to
// a main column with sections in a fixed order, regardless of how much
// content any given resume actually has.
function ClassicDossierBody({ resume }: { resume: Resume }) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className={`${panel} p-5 md:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
          <div className="flex items-start gap-4">
            <InitialsBadge name={resume.name || resume.file_name} size={52} />
            <div>
              <div className="text-xs text-muted-foreground">{resume.file_name} · {formatDate(resume.uploaded_at)}</div>
              <h2 className="mt-2 font-display text-2xl">{resume.name || "Unnamed candidate"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{resume.summary || "No summary returned."}</p>
            </div>
          </div>
          <ScoreValue score={resume.resume_rating} />
        </div>
        <div className="mt-6 space-y-6">
          <DetailSection title="Work experience">{resume.work_experience.map((experience, index) => <ExperienceBlock key={`${experience.company}-${index}`} experience={experience} />)}</DetailSection>
          <DetailSection title="Education"><div className="grid gap-3 sm:grid-cols-2">{resume.education.map((item) => <div key={`${item.institution}-${item.degree}`} className="rounded-lg border border-border/60 bg-raise/40 p-4"><div className="font-medium">{item.degree}</div><div className="mt-1 text-sm text-muted-foreground">{item.institution} · {item.graduation_year}</div></div>)}</div></DetailSection>
          <DetailSection title="Projects"><div className="grid gap-3 sm:grid-cols-2">{resume.projects.map((project) => <div key={project.name} className="rounded-lg border border-border/60 bg-raise/40 p-4"><div className="font-medium">{project.name}</div><div className="mt-1 text-sm text-muted-foreground">{project.description}</div><div className="mt-3"><TagList items={project.technologies} /></div></div>)}</div></DetailSection>
          <DetailSection title="Certifications"><BulletList items={resume.certifications} /></DetailSection>
        </div>
      </section>
      <div className="flex flex-col gap-4">
        <InfoPanel title="Contact"><div className="space-y-2 text-sm text-muted-foreground">{[resume.email, resume.phone, resume.linkedin_url, resume.portfolio_url].filter(Boolean).map((item) => <div key={item}>{item}</div>)}</div></InfoPanel>
        <InfoPanel title="Skills"><TagList items={[...resume.technical_skills, ...resume.soft_skills]} /></InfoPanel>
        <InfoPanel title="Improvement areas"><p className="text-sm text-muted-foreground">{resume.improvement_areas || "No improvement areas returned."}</p></InfoPanel>
        <InfoPanel title="Upskill suggestions"><BulletList items={resume.upskill_suggestions} /></InfoPanel>
      </div>
    </div>
  );
}

// Content-aware grid: still a main column + sidebar, but which sections show
// up, in what order, and how wide they render all depend on this specific
// resume's content - not a fixed template every resume is forced into.
function FlowDossierBody({ resume }: { resume: Resume }) {
  const profile = getResumeContentProfile(resume);
  const work = profile.sections.find((section) => section.key === "work")!;
  const restSections = byRichnessThenOriginal(profile.sections.filter((section) => section.key !== "work" && section.richness !== "empty"));
  const skillsPanel = profile.panels.find((panelInfo) => panelInfo.key === "skills")!;
  // A long skills list gets cramped in a 340px sidebar - once it's rich
  // enough, give it a full-width home in the main column instead.
  const promoteSkills = skillsPanel.richness === "rich";
  const sidebarPanels = profile.panels.filter((panelInfo) => panelInfo.richness !== "empty" && !(panelInfo.key === "skills" && promoteSkills));
  const cardGridClass = (richness: SectionRichness) => (richness === "sparse" ? "grid gap-3" : "grid gap-3 sm:grid-cols-2");
  return (
    <div className={`mt-4 grid gap-4 ${sidebarPanels.length ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
      <section className={`${panel} p-5 md:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
          <div className="flex items-start gap-4">
            <InitialsBadge name={resume.name || resume.file_name} size={52} />
            <div>
              <div className="text-xs text-muted-foreground">{resume.file_name} · {formatDate(resume.uploaded_at)}</div>
              <h2 className="mt-2 font-display text-2xl">{resume.name || "Unnamed candidate"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{resume.summary || "No summary returned."}</p>
            </div>
          </div>
          <ScoreValue score={resume.resume_rating} />
        </div>
        <div className="mt-6 space-y-6">
          {work.richness !== "empty" && <DetailSection title="Work experience">{resume.work_experience.map((experience, index) => <ExperienceBlock key={`${experience.company}-${index}`} experience={experience} />)}</DetailSection>}
          {promoteSkills && <DetailSection title="Skills"><TagList items={[...resume.technical_skills, ...resume.soft_skills]} /></DetailSection>}
          {restSections.map((section) => {
            if (section.key === "education") return <DetailSection key="education" title="Education"><div className={cardGridClass(section.richness)}>{resume.education.map((item) => <div key={`${item.institution}-${item.degree}`} className="rounded-lg border border-border/60 bg-raise/40 p-4"><div className="font-medium">{item.degree}</div><div className="mt-1 text-sm text-muted-foreground">{item.institution} · {item.graduation_year}</div></div>)}</div></DetailSection>;
            if (section.key === "projects") return <DetailSection key="projects" title="Projects"><div className={cardGridClass(section.richness)}>{resume.projects.map((project) => <div key={project.name} className="rounded-lg border border-border/60 bg-raise/40 p-4"><div className="font-medium">{project.name}</div><div className="mt-1 text-sm text-muted-foreground">{project.description}</div><div className="mt-3"><TagList items={project.technologies} /></div></div>)}</div></DetailSection>;
            if (section.key === "certifications") return <DetailSection key="certifications" title="Certifications"><BulletList items={resume.certifications} /></DetailSection>;
            return null;
          })}
        </div>
      </section>
      {sidebarPanels.length > 0 && (
        <div className="flex flex-col gap-4">
          {sidebarPanels.map((panelInfo) => {
            if (panelInfo.key === "contact") return <InfoPanel key="contact" title="Contact"><div className="space-y-2 text-sm text-muted-foreground">{[resume.email, resume.phone, resume.linkedin_url, resume.portfolio_url].filter(Boolean).map((item) => <div key={item}>{item}</div>)}</div></InfoPanel>;
            if (panelInfo.key === "skills") return <InfoPanel key="skills" title="Skills"><TagList items={[...resume.technical_skills, ...resume.soft_skills]} /></InfoPanel>;
            if (panelInfo.key === "improvement") return <InfoPanel key="improvement" title="Improvement areas"><p className="text-sm text-muted-foreground">{resume.improvement_areas}</p></InfoPanel>;
            if (panelInfo.key === "upskills") return <InfoPanel key="upskills" title="Upskill suggestions"><BulletList items={resume.upskill_suggestions} /></InfoPanel>;
            return null;
          })}
        </div>
      )}
    </div>
  );
}

// True masonry/waterfall: every section - and every individual work
// experience, education, and project entry - becomes its own independent
// card. Cards pack into columns by their natural height (CSS multi-column
// layout), so no two resumes with different amounts of content end up with
// the same silhouette. Empty sections simply contribute no card.
function MasonryDossierBody({ resume }: { resume: Resume }) {
  const profile = getResumeContentProfile(resume);
  const cardClass = `${panel} mb-4 break-inside-avoid p-5`;
  return (
    <div className="mt-4 columns-1 gap-4 md:columns-2 xl:columns-3">
      <div className={cardClass}>
        <div className="flex items-start gap-4">
          <InitialsBadge name={resume.name || resume.file_name} size={44} />
          <div>
            <div className="text-xs text-muted-foreground">{resume.file_name} · {formatDate(resume.uploaded_at)}</div>
            <h2 className="mt-2 font-display text-2xl">{resume.name || "Unnamed candidate"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{resume.summary || "No summary returned."}</p>
          </div>
        </div>
        <div className="mt-4"><ScoreValue score={resume.resume_rating} /></div>
      </div>
      {resume.work_experience.map((experience, index) => (
        <div key={`work-${experience.company}-${index}`} className={cardClass}>
          <h3 className="font-display text-lg">Work experience</h3>
          <div className="mt-3"><ExperienceBlock experience={experience} /></div>
        </div>
      ))}
      {resume.education.map((item) => (
        <div key={`education-${item.institution}-${item.degree}`} className={cardClass}>
          <h3 className="font-display text-lg">Education</h3>
          <div className="mt-3 rounded-lg border border-border/60 bg-raise/40 p-4"><div className="font-medium">{item.degree}</div><div className="mt-1 text-sm text-muted-foreground">{item.institution} · {item.graduation_year}</div></div>
        </div>
      ))}
      {resume.projects.map((project) => (
        <div key={`project-${project.name}`} className={cardClass}>
          <h3 className="font-display text-lg">Project</h3>
          <div className="mt-3 rounded-lg border border-border/60 bg-raise/40 p-4"><div className="font-medium">{project.name}</div><div className="mt-1 text-sm text-muted-foreground">{project.description}</div><div className="mt-3"><TagList items={project.technologies} /></div></div>
        </div>
      ))}
      {resume.certifications.length > 0 && <div className={cardClass}><h3 className="font-display text-lg">Certifications</h3><div className="mt-3"><BulletList items={resume.certifications} /></div></div>}
      {profile.panels.filter((panelInfo) => panelInfo.richness !== "empty").map((panelInfo) => {
        if (panelInfo.key === "contact") return <div key="contact" className={cardClass}><h3 className="font-display text-lg">Contact</h3><div className="mt-3 space-y-2 text-sm text-muted-foreground">{[resume.email, resume.phone, resume.linkedin_url, resume.portfolio_url].filter(Boolean).map((item) => <div key={item}>{item}</div>)}</div></div>;
        if (panelInfo.key === "skills") return <div key="skills" className={cardClass}><h3 className="font-display text-lg">Skills</h3><div className="mt-3"><TagList items={[...resume.technical_skills, ...resume.soft_skills]} /></div></div>;
        if (panelInfo.key === "improvement") return <div key="improvement" className={cardClass}><h3 className="font-display text-lg">Improvement areas</h3><p className="mt-3 text-sm text-muted-foreground">{resume.improvement_areas}</p></div>;
        if (panelInfo.key === "upskills") return <div key="upskills" className={cardClass}><h3 className="font-display text-lg">Upskill suggestions</h3><div className="mt-3"><BulletList items={resume.upskill_suggestions} /></div></div>;
        return null;
      })}
    </div>
  );
}

export function MatchPage() { const { id } = useParams({ strict: false }); const [description, setDescription] = useState(""); const [result, setResult] = useState<MatchResult | null>(null); const match = useApiAction(api.match); const submit = async () => { if (!id || description.trim().length < 30) return; try { setResult(await match.run(id, description.trim())); } catch { /* surfaced inline */ } }; return <AppLayout><PageHeader eyebrow="JD match" title="Score your resume against a role" description="Paste the job description and find the strongest overlap, missing signals, and ATS friction." actions={id ? <Button asChild variant="outline" className={quietButton}><Link to="/resumes/$id" params={{ id }}>Back to dossier</Link></Button> : undefined} /><div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><section className={`${panel} p-5 md:p-6`}><div className="flex items-center justify-between"><div className="font-display text-lg">Job description</div><span className="text-xs text-muted-foreground">Minimum 30 characters</span></div><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Paste the role, responsibilities, and requirements here…" className="mt-4 min-h-72 border-border/70 bg-raise/40" /><div className="mt-3 flex items-center justify-between gap-3"><span className={`text-xs ${description.trim().length < 30 ? "text-destructive" : "text-muted-foreground"}`}>{description.trim().length < 30 ? `${description.trim().length}/30 characters minimum` : `${description.trim().length} characters`}</span><Button onClick={submit} disabled={description.trim().length < 30 || match.loading} className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt">{match.loading ? <><span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />Scoring…</> : <><Sparkles />Score my resume</>}</Button></div><ErrorNote message={match.error} /></section>{result ? <MatchResultPanel result={result} /> : <section className={`${panel} flex min-h-64 items-center justify-center p-6 text-center`}><div><div className="mx-auto grid size-12 place-items-center rounded-full border border-brass/25 text-brass"><BriefcaseBusiness /></div><h2 className="mt-4 font-display text-xl">Your match score will land here.</h2><p className="mt-2 max-w-xs text-sm text-muted-foreground">See how clearly your resume speaks to this specific role.</p></div></section>}</div></AppLayout>; }
function MatchResultPanel({ result }: { result: MatchResult }) { return <section className={`${panel} p-5 md:p-6`}><div className="flex items-center gap-5"><ScoreGauge value={result.match_score} max={100} size={124} /><div><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Match score</div><p className="mt-1 max-w-xs text-sm text-muted-foreground">How closely this resume lines up with the role you pasted.</p></div></div><div className="mt-6 space-y-5"><MatchList title="Matched keywords" items={result.matched_keywords} /><MatchList title="Missing keywords" items={result.missing_keywords} /><MatchList title="ATS formatting issues" items={result.ats_issues} /><div><h3 className="font-display text-lg">Summary</h3><p className="mt-2 text-sm text-muted-foreground">{result.summary}</p></div><div><h3 className="font-display text-lg">Recommendation</h3><p className="mt-2 text-sm text-muted-foreground">{result.recommendation}</p></div></div></section>; }
function MatchList({ title, items }: { title: string; items: string[] }) { return <div><h3 className="font-display text-lg">{title}</h3>{items.length ? <div className="mt-2 flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-full border border-border bg-raise/50 px-3 py-1 text-xs text-muted-foreground">{item}</span>)}</div> : <p className="mt-2 text-sm text-muted-foreground">None returned.</p>}</div>; }


function PasswordField({ label, value, onChange, placeholder, autoComplete }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block text-sm">
      {label}
      <div className="relative mt-2">
        <Input required minLength={6} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="border-border/70 bg-raise pr-10" placeholder={placeholder} />
        <button type="button" onClick={() => setVisible((current) => !current)} className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={visible ? "Hide password" : "Show password"} tabIndex={-1}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </label>
  );
}

export function AuthPage({ mode }: { mode: "login" | "register" }) { const { user, ready, signIn } = useAuth(); const navigate = useNavigate(); const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" }); const action = useApiAction(mode === "login" ? api.login : api.register); const passwordsMismatched = mode === "register" && form.confirmPassword.length > 0 && form.password !== form.confirmPassword; useEffect(() => { if (ready && user) void navigate({ to: "/" }); }, [navigate, ready, user]); const submit = async (event: React.FormEvent) => { event.preventDefault(); if (mode === "register" && form.password !== form.confirmPassword) return; try { const result = await action.run(mode === "login" ? { email: form.email, password: form.password } : { name: form.name, email: form.email, password: form.password }); signIn(result.token, result.user); void navigate({ to: "/" }); } catch { /* surfaced inline */ } }; return <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10"><div className="w-full max-w-md"><Brand /><div className={`${panel} mt-8 p-6 md:p-8`}><div className="text-[11px] uppercase tracking-[0.2em] text-brass/80">{mode === "login" ? "Welcome back" : "Create your dossier"}</div><h1 className="mt-2 font-display text-3xl">{mode === "login" ? "Sign in to DeepKlarity" : "Start with your resume"}</h1><p className="mt-2 text-sm text-muted-foreground">{mode === "login" ? "Pick up where your last analysis left off." : "Create an account to keep every analysis in one place."}</p><form className="mt-6 space-y-4" onSubmit={submit}>{mode === "register" && <label className="block text-sm">Name<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 border-border/70 bg-raise" placeholder="Your name" /></label>}<label className="block text-sm">Email<Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 border-border/70 bg-raise" placeholder="you@example.com" /></label><PasswordField label="Password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} placeholder="At least 6 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} />{mode === "register" && <div><PasswordField label="Confirm password" value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} placeholder="Re-enter your password" autoComplete="new-password" />{passwordsMismatched && <p className="mt-1.5 text-xs text-destructive">Passwords don't match.</p>}</div>}<ErrorNote message={action.error} /><Button type="submit" disabled={action.loading || passwordsMismatched} className="h-10 w-full rounded-full bg-brass text-primary-foreground hover:bg-brass-lt">{action.loading ? <><span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />{mode === "login" ? "Signing in…" : "Creating account…"}</> : mode === "login" ? "Sign in" : "Create account"}</Button></form><p className="mt-6 text-center text-sm text-muted-foreground">{mode === "login" ? "New to DeepKlarity?" : "Already have an account?"} <Link className="text-brass hover:text-brass-lt" to={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Create one" : "Sign in"}</Link></p></div></div></div>; }
const POSTED_WITHIN_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Posted: any time" },
  { value: "7", label: "Posted within 7 days" },
  { value: "15", label: "Posted within 15 days" },
  { value: "30", label: "Posted within 30 days" },
];
const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType | ""; label: string }[] = [
  { value: "", label: "Any employment type" },
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "permanent", label: "Permanent" },
];

type JobsPageFilterState = { what: string; where: string; maxDaysOld: string; employmentType: EmploymentType | ""; salaryMin: string; salaryMax: string };

export function JobsPage() {
  // Present only when this page is mounted at /resumes/$id/jobs (a deep
  // link from a specific resume's dossier) - absent on the standalone
  // /jobs route. selectedResumeId is this page's OWN resume choice, used
  // only on the standalone route; pathResumeId always wins when present,
  // since that's an explicit deep link the dossier page constructed.
  const { id: pathResumeId } = useParams({ strict: false });
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobMatch[] | null>(null);
  const [candidateExperienceYears, setCandidateExperienceYears] = useState<number | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [maxDaysOld, setMaxDaysOld] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  // These two filters never touch the network - they just narrow down
  // whatever the last search already fetched, so toggling them applies
  // instantly instead of waiting on another round trip.
  const [goodFitOnly, setGoodFitOnly] = useState(false);
  const [skillMatchOnly, setSkillMatchOnly] = useState(false);
  const [resumeOptions, setResumeOptions] = useState<ResumeListItem[] | null>(null);
  const search = useApiAction(api.getJobMatches);
  const effectiveResumeId = pathResumeId ?? (selectedResumeId || undefined);
  const load = async (overrides: Partial<JobsPageFilterState> = {}) => {
    const effective = { what, where, maxDaysOld, employmentType, salaryMin, salaryMax, ...overrides };
    try {
      const result = await search.run({
        resumeId: effectiveResumeId,
        what: effective.what.trim() || undefined,
        where: effective.where.trim() || undefined,
        maxDaysOld: effective.maxDaysOld ? Number(effective.maxDaysOld) : undefined,
        salaryMin: effective.salaryMin ? Number(effective.salaryMin) : undefined,
        salaryMax: effective.salaryMax ? Number(effective.salaryMax) : undefined,
        employmentType: effective.employmentType || undefined,
      });
      setJobs(result.data);
      setCandidateExperienceYears(result.candidateExperienceYears);
    } catch {
      /* surfaced inline */
    }
  };
  // Re-searches whenever which resume (if any) is in play changes - a
  // fresh path id from the dossier, or a pick from this page's own
  // dropdown. No resume selected is a valid, immediately-loadable state:
  // it runs a plain, unranked search rather than waiting for a pick.
  useEffect(() => { void load(); }, [pathResumeId, selectedResumeId]);
  // The list of every analyzed resume, so this page can offer ranking
  // against one without a trip back through the dossier.
  useEffect(() => {
    let cancelled = false;
    api.listResumes(1, 50, "").then((result) => { if (!cancelled) setResumeOptions(result.data); }).catch(() => { /* the picker is a convenience, not critical */ });
    return () => { cancelled = true; };
  }, []);
  const activeResume = resumeOptions?.find((item) => String(item.id) === effectiveResumeId);
  const hasActiveFilters = Boolean(what || where || maxDaysOld || employmentType || salaryMin || salaryMax || goodFitOnly || skillMatchOnly);
  const clearFilters = () => {
    setWhat("");
    setWhere("");
    setMaxDaysOld("");
    setEmploymentType("");
    setSalaryMin("");
    setSalaryMax("");
    setGoodFitOnly(false);
    setSkillMatchOnly(false);
    void load({ what: "", where: "", maxDaysOld: "", employmentType: "", salaryMin: "", salaryMax: "" });
  };
  const visibleJobs = jobs?.filter((job) => (!goodFitOnly || job.experienceFit.tier === "good") && (!skillMatchOnly || job.score > 0)) ?? null;
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Job matches"
        title={effectiveResumeId ? "Live openings ranked for this resume" : "Search live job openings"}
        description={effectiveResumeId ? "Pulled from current postings and ranked by how much of what each job asks for this resume actually covers." : "Search current postings for anyone - pick a resume below if you'd like results ranked against its skills and experience."}
        actions={pathResumeId ? <Button asChild variant="outline" className={quietButton}><Link to="/resumes/$id" params={{ id: pathResumeId }}>Back to dossier</Link></Button> : undefined}
      />
      {pathResumeId ? (
        resumeOptions && resumeOptions.length > 1 && (
          <label className="mt-6 block max-w-md text-sm">
            Matching against
            <select
              value={pathResumeId}
              onChange={(event) => void navigate({ to: "/resumes/$id/jobs", params: { id: event.target.value } })}
              className="mt-2 h-10 w-full rounded-md border border-border/70 bg-panel px-3 text-sm text-foreground"
            >
              {resumeOptions.map((item) => <option key={item.id} value={item.id}>{item.file_name}{item.name ? ` — ${item.name}` : ""}</option>)}
            </select>
          </label>
        )
      ) : (
        resumeOptions && resumeOptions.length > 0 && (
          <label className="mt-6 block max-w-md text-sm">
            Rank against a resume (optional)
            <select
              value={selectedResumeId}
              onChange={(event) => setSelectedResumeId(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-border/70 bg-panel px-3 text-sm text-foreground"
            >
              <option value="">Search for anyone — no ranking</option>
              {resumeOptions.map((item) => <option key={item.id} value={item.id}>{item.file_name}{item.name ? ` — ${item.name}` : ""}</option>)}
            </select>
          </label>
        )
      )}
      <form className="mt-6 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={what} onChange={(event) => setWhat(event.target.value)} placeholder="Role or keywords (e.g. backend engineer)" className="h-10 rounded-full border-border/70 bg-panel pl-9" /></div>
        <div className="relative min-w-[160px] flex-1"><MapPin className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={where} onChange={(event) => setWhere(event.target.value)} placeholder="Location (optional)" className="h-10 rounded-full border-border/70 bg-panel pl-9" /></div>
        <Button type="submit" disabled={search.loading} className="h-10 rounded-full bg-brass text-primary-foreground hover:bg-brass-lt"><Filter />{search.loading ? "Searching…" : "Search"}</Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={maxDaysOld} onChange={(event) => setMaxDaysOld(event.target.value)} className="h-9 rounded-md border border-border/70 bg-panel px-3 text-xs text-foreground">
          {POSTED_WITHIN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value as EmploymentType | "")} className="h-9 rounded-md border border-border/70 bg-panel px-3 text-xs text-foreground">
          {EMPLOYMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <Input value={salaryMin} onChange={(event) => setSalaryMin(event.target.value.replace(/\D/g, ""))} placeholder="Min salary" inputMode="numeric" className="h-9 w-28 border-border/70 bg-panel text-xs" />
          <span className="text-xs text-muted-foreground">–</span>
          <Input value={salaryMax} onChange={(event) => setSalaryMax(event.target.value.replace(/\D/g, ""))} placeholder="Max salary" inputMode="numeric" className="h-9 w-28 border-border/70 bg-panel text-xs" />
        </div>
        {effectiveResumeId && <FilterChip label="Confirmed experience fit only" active={goodFitOnly} onClick={() => setGoodFitOnly((value) => !value)} />}
        {effectiveResumeId && <FilterChip label="Matches my skills only" active={skillMatchOnly} onClick={() => setSkillMatchOnly((value) => !value)} />}
        {hasActiveFilters && <Button type="button" variant="outline" className={`${quietButton} h-9`} onClick={clearFilters}><X />Clear filters</Button>}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Posted-within, employment type, and salary range apply on Search. {effectiveResumeId ? "The two toggles above apply instantly to the results already loaded." : "Pick a resume above to unlock experience-fit and skill-match filtering."}</p>
      {activeResume ? (
        <p className="mt-2 text-xs text-muted-foreground">Currently matching against <span className="text-foreground">{activeResume.file_name}</span>{activeResume.name ? ` (${activeResume.name})` : ""}.</p>
      ) : (
        !pathResumeId && <p className="mt-2 text-xs text-muted-foreground">Showing general results, not ranked against any resume.</p>
      )}
      {candidateExperienceYears !== null && candidateExperienceYears > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Based on this resume's work history, you have <span className="text-brass-lt">~{candidateExperienceYears.toFixed(1)} {candidateExperienceYears === 1 ? "year" : "years"}</span> of experience. Results are ranked by experience fit first, skill match second.
        </p>
      )}
      <div className="mt-6">
        <ErrorNote message={search.error} />
        {jobs === null ? (
          <LoadingState label="Finding matching roles…" />
        ) : visibleJobs && visibleJobs.length ? (
          <div className="grid gap-4">{visibleJobs.map((job) => <JobCard key={job.id} job={job} resumeId={effectiveResumeId} />)}</div>
        ) : jobs.length > 0 ? (
          <FilteredEmptyJobs onClear={clearFilters} />
        ) : (
          <EmptyJobs />
        )}
      </div>
    </AppLayout>
  );
}

// Labels/styling for the experience-fit tiers computed on the backend
// (backend/utils/experience.js - scoreExperienceFit). "unknown" (most
// postings don't state a number of years) is intentionally not shown as a
// badge at all - it's a neutral, unremarkable case, not a signal worth a
// visual callout.
const EXPERIENCE_FIT_STYLES: Record<Exclude<JobMatch["experienceFit"]["tier"], "unknown">, { label: string; className: string }> = {
  good: { label: "Good experience fit", className: "border-brass/30 bg-brass/10 text-brass-lt" },
  underqualified: { label: "Needs more experience", className: "border-destructive/30 bg-destructive/10 text-destructive-foreground" },
  overqualified: { label: "May be overqualified", className: "border-border/60 bg-raise/40 text-muted-foreground" },
};

function ExperienceFitBadge({ tier }: { tier: JobMatch["experienceFit"]["tier"] }) {
  if (tier === "unknown") return null;
  const style = EXPERIENCE_FIT_STYLES[tier];
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${style.className}`}>{style.label}</span>;
}

function formatExperienceRequirement(requirement: JobMatch["experienceRequirement"]): string | null {
  if (!requirement) return null;
  const { min, max, approximate } = requirement;
  let core: string;
  if (min != null && max != null && min === max) core = `${min} yrs experience`;
  else if (min != null && max != null) core = `${min}–${max} yrs experience`;
  else if (min != null) core = `${min}+ yrs experience`;
  else if (max != null) core = `Up to ${max} yrs experience`;
  else return null;
  return approximate ? `${core} (approx., from title)` : core;
}

function formatEmploymentType(job: Pick<JobMatch, "contractTime" | "contractType">): string | null {
  const parts = [
    job.contractTime === "full_time" ? "Full-time" : job.contractTime === "part_time" ? "Part-time" : null,
    job.contractType === "permanent" ? "Permanent" : job.contractType === "contract" ? "Contract" : null,
  ].filter((part): part is string => part != null);
  return parts.length ? parts.join(" · ") : null;
}

function JobCard({ job, resumeId }: { job: JobMatch; resumeId?: string | undefined }) {
  const save = useApiAction(api.createApplication);
  const [saved, setSaved] = useState(false);
  const track = async () => {
    try {
      await save.run({ company: job.company, roleTitle: job.title, jobUrl: job.url || undefined, status: "saved", resumeId });
      setSaved(true);
      toast.success("Added to your application tracker.");
    } catch {
      /* surfaced inline */
    }
  };
  const shortDescription = job.description.length > 260 ? `${job.description.slice(0, 260).trim()}…` : job.description;
  const experienceRequirementText = formatExperienceRequirement(job.experienceRequirement);
  const employmentTypeText = formatEmploymentType(job);
  return (
    <div className={`${panel} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-display text-lg">{job.title}</div>
            <ExperienceFitBadge tier={job.experienceFit.tier} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Building2 className="size-3.5" />{job.company}</span>
            <span className="flex items-center gap-1"><MapPin className="size-3.5" />{job.location}</span>
            {(job.salaryMin || job.salaryMax) && <span className="flex items-center gap-1"><DollarSign className="size-3.5" />{[job.salaryMin, job.salaryMax].filter((value): value is number => value != null).map((value) => value.toLocaleString()).join(" – ")}</span>}
            {employmentTypeText && <span className="flex items-center gap-1">{employmentTypeText}</span>}
            {experienceRequirementText && <span className="flex items-center gap-1">{experienceRequirementText}</span>}
          </div>
        </div>
        <div className="shrink-0"><ScoreGauge value={job.score} max={100} size={64} strokeWidth={6} label="Skill match" /></div>
      </div>
      {job.matchedSkills.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">You have</div>
          <div className="mt-1.5"><TagList items={job.matchedSkills} /></div>
        </div>
      )}
      {job.missingSkills.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">This role also wants</div>
          <div className="mt-1.5 flex flex-wrap gap-2">{job.missingSkills.map((skill) => <span key={skill} className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs text-destructive-foreground">{skill}</span>)}</div>
        </div>
      )}
      {shortDescription && <p className="mt-3 text-sm text-muted-foreground">{shortDescription}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {job.url && <Button asChild variant="outline" className={quietButton}><a href={job.url} target="_blank" rel="noreferrer"><ExternalLink />View posting</a></Button>}
        <Button variant="outline" className={quietButton} onClick={track} disabled={save.loading || saved}>{saved ? <><Check />Saved</> : <><Plus />Track application</>}</Button>
      </div>
      {save.error && <div className="mt-2"><ErrorNote message={save.error} /></div>}
    </div>
  );
}

function EmptyJobs() { return <section className={`${panel} flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center`}><div className="grid size-12 place-items-center rounded-full border border-brass/25 text-brass"><BriefcaseBusiness /></div><h2 className="mt-4 font-display text-xl">No open roles matched right now.</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Try a broader keyword or a different location, or check back soon as new postings come in.</p></section>; }

// Distinct from EmptyJobs: this is what happens when Adzuna DID return
// postings, but the "confirmed experience fit" / "matches my skills"
// toggles (both client-side, see JobsPage) filtered every one of them out.
// A different message here matters - the fix is "loosen your filters", not
// "try a different search".
function FilteredEmptyJobs({ onClear }: { onClear: () => void }) {
  return (
    <section className={`${panel} flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center`}>
      <div className="grid size-12 place-items-center rounded-full border border-brass/25 text-brass"><Filter /></div>
      <h2 className="mt-4 font-display text-xl">No roles match your current filters.</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Postings came back for this search, but none passed the "confirmed experience fit" / "matches my skills" toggles. Try clearing filters to see everything.</p>
      <Button variant="outline" className={`${quietButton} mt-4`} onClick={onClear}><X />Clear filters</Button>
    </section>
  );
}

export function CoverLetterPage() {
  const { id } = useParams({ strict: false });
  const [description, setDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tone, setTone] = useState<CoverLetterTone>("professional");
  const [letter, setLetter] = useState<string | null>(null);
  const generate = useApiAction(api.generateCoverLetter);
  const submit = async () => {
    if (!id || description.trim().length < 30) return;
    try {
      setLetter((await generate.run(id, description.trim(), companyName.trim() || undefined, tone)).coverLetter);
    } catch {
      /* surfaced inline */
    }
  };
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Cover letter"
        title="Draft a tailored cover letter"
        description="Grounded in this resume's actual experience - paste the job description and pick a tone."
        actions={id ? <Button asChild variant="outline" className={quietButton}><Link to="/resumes/$id" params={{ id }}>Back to dossier</Link></Button> : undefined}
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className={`${panel} p-5 md:p-6`}>
          <div className="font-display text-lg">Job description</div>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Paste the role, responsibilities, and requirements here…" className="mt-4 min-h-56 border-border/70 bg-raise/40" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">Company (optional)<Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="mt-2 h-10 border-border/70 bg-raise" placeholder="e.g. Acme Corp" /></label>
            <label className="block text-sm">Tone
              <select value={tone} onChange={(event) => setTone(event.target.value as CoverLetterTone)} className="mt-2 h-10 w-full rounded-md border border-border/70 bg-raise px-3 text-sm text-foreground">
                <option value="professional">Professional</option>
                <option value="enthusiastic">Enthusiastic</option>
                <option value="concise">Concise</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`text-xs ${description.trim().length < 30 ? "text-destructive" : "text-muted-foreground"}`}>{description.trim().length < 30 ? `${description.trim().length}/30 characters minimum` : `${description.trim().length} characters`}</span>
            <Button onClick={submit} disabled={description.trim().length < 30 || generate.loading} className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt">{generate.loading ? <><span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />Drafting…</> : <><Sparkles />Draft cover letter</>}</Button>
          </div>
          <ErrorNote message={generate.error} />
        </section>
        {letter ? (
          <section className={`${panel} score-reveal p-5 md:p-6`}>
            <div className="flex items-center justify-between"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Draft</div><CopyButton text={letter} /></div>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{letter}</div>
          </section>
        ) : (
          <section className={`${panel} flex min-h-64 items-center justify-center p-6 text-center`}><div><div className="mx-auto grid size-12 place-items-center rounded-full border border-brass/25 text-brass"><Mail /></div><h2 className="mt-4 font-display text-xl">Your draft will land here.</h2><p className="mt-2 max-w-xs text-sm text-muted-foreground">Always review before sending - treat it as a strong first draft.</p></div></section>
        )}
      </div>
    </AppLayout>
  );
}

const APPLICATION_STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

export function ApplicationsPage() {
  const [items, setItems] = useState<Application[] | null>(null);
  const [filter, setFilter] = useState<ApplicationStatus | "">("");
  const [showForm, setShowForm] = useState(false);
  const list = useApiAction(api.listApplications);
  const load = async (status: ApplicationStatus | "" = filter) => {
    try {
      setItems((await list.run(status)).data);
    } catch {
      /* surfaced inline */
    }
  };
  useEffect(() => { void load(); }, []);
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Tracker"
        title="Your applications"
        description="Every role you're pursuing, in one place - add manually or save straight from job matches."
        actions={<Button onClick={() => setShowForm((current) => !current)} className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt">{showForm ? <><X />Close</> : <><Plus />Add application</>}</Button>}
      />
      {showForm && <NewApplicationForm onCreated={(application) => { setItems((current) => [application, ...(current || [])]); setShowForm(false); }} />}
      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip label="All" active={filter === ""} onClick={() => { setFilter(""); void load(""); }} />
        {APPLICATION_STATUSES.map((status) => <FilterChip key={status.value} label={status.label} active={filter === status.value} onClick={() => { setFilter(status.value); void load(status.value); }} />)}
      </div>
      <div className="mt-4">
        <ErrorNote message={list.error} />
        {items === null ? <LoadingState label="Loading your tracker…" /> : items.length ? (
          <div className="grid gap-3">
            {items.map((application) => (
              <ApplicationRow
                key={application.id}
                application={application}
                onChanged={(next) => setItems((current) => (current || []).map((item) => (item.id === next.id ? next : item)))}
                onDeleted={(deletedId) => setItems((current) => (current || []).filter((item) => item.id !== deletedId))}
              />
            ))}
          </div>
        ) : <EmptyApplications />}
      </div>
    </AppLayout>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active ? "border-brass/60 bg-brass/15 text-brass" : "border-border/70 bg-transparent text-muted-foreground hover:bg-raise"}`}>{label}</button>; }

function NewApplicationForm({ onCreated }: { onCreated: (application: Application) => void }) {
  const [form, setForm] = useState({ company: "", roleTitle: "", jobUrl: "", notes: "" });
  const create = useApiAction(api.createApplication);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.company.trim() || !form.roleTitle.trim()) return;
    try {
      const application = await create.run({ company: form.company.trim(), roleTitle: form.roleTitle.trim(), jobUrl: form.jobUrl.trim() || undefined, notes: form.notes.trim() || undefined });
      onCreated(application);
    } catch {
      /* surfaced inline */
    }
  };
  return (
    <form className={`${panel} mt-4 grid gap-3 p-5 sm:grid-cols-2`} onSubmit={submit}>
      <label className="block text-sm">Company<Input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} className="mt-2 h-10 border-border/70 bg-raise" placeholder="e.g. Acme Corp" /></label>
      <label className="block text-sm">Role<Input required value={form.roleTitle} onChange={(event) => setForm({ ...form, roleTitle: event.target.value })} className="mt-2 h-10 border-border/70 bg-raise" placeholder="e.g. Backend Engineer" /></label>
      <label className="block text-sm sm:col-span-2">Job posting URL (optional)<Input value={form.jobUrl} onChange={(event) => setForm({ ...form, jobUrl: event.target.value })} className="mt-2 h-10 border-border/70 bg-raise" placeholder="https://…" /></label>
      <label className="block text-sm sm:col-span-2">Notes (optional)<Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 min-h-20 border-border/70 bg-raise" placeholder="Referral, recruiter contact, prep notes…" /></label>
      <div className="sm:col-span-2"><ErrorNote message={create.error} /><Button type="submit" disabled={create.loading} className="mt-1 rounded-full bg-brass text-primary-foreground hover:bg-brass-lt">{create.loading ? "Adding…" : "Add to tracker"}</Button></div>
    </form>
  );
}

function ApplicationRow({ application, onChanged, onDeleted }: { application: Application; onChanged: (application: Application) => void; onDeleted: (id: number) => void }) {
  const update = useApiAction(api.updateApplication);
  const remove = useApiAction(api.deleteApplication);
  const [confirming, setConfirming] = useState(false);
  const changeStatus = async (status: ApplicationStatus) => {
    try {
      onChanged(await update.run(application.id, { status }));
    } catch {
      /* surfaced inline */
    }
  };
  const del = async () => {
    if (!confirming) { setConfirming(true); return; }
    try {
      await remove.run(application.id);
      onDeleted(application.id);
    } catch {
      /* surfaced inline */
    }
  };
  return (
    <div className={`${panel} flex flex-wrap items-center justify-between gap-4 p-4`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-medium"><Building2 className="size-4 text-muted-foreground" />{application.company}</div>
        <div className="mt-1 text-sm text-muted-foreground">{application.role_title}</div>
        {application.job_url && <a href={application.job_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brass hover:text-brass-lt"><ExternalLink className="size-3" />View posting</a>}
        {application.notes && <p className="mt-2 text-xs text-muted-foreground">{application.notes}</p>}
      </div>
      <div className="flex items-center gap-2">
        <select value={application.status} onChange={(event) => void changeStatus(event.target.value as ApplicationStatus)} disabled={update.loading} className="h-9 rounded-md border border-border/70 bg-raise px-2 text-xs text-foreground">
          {APPLICATION_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
        <Button variant="outline" size="icon" className={quietButton} onClick={del} onBlur={() => setConfirming(false)} aria-label={confirming ? "Confirm delete" : "Delete"}><Trash2 className={confirming ? "text-destructive" : ""} /></Button>
      </div>
      {(update.error || remove.error) && <div className="w-full"><ErrorNote message={update.error || remove.error} /></div>}
    </div>
  );
}

function EmptyApplications() { return <section className={`${panel} flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center`}><div className="grid size-12 place-items-center rounded-full border border-brass/25 text-brass"><ClipboardList /></div><h2 className="mt-4 font-display text-xl">Nothing tracked yet.</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Add a role manually, or save one straight from your job matches.</p></section>; }

type RoadmapStep = { title: string; detail: string; skills: string[] };
type RoadmapTrack = { key: string; title: string; tagline: string; steps: RoadmapStep[] };

const ROADMAP_TRACKS: RoadmapTrack[] = [
  {
    key: "frontend",
    title: "Frontend engineering",
    tagline: "From markup to production-grade UI systems.",
    steps: [
      { title: "Foundations", detail: "Semantic HTML, CSS layout with flexbox and grid, and core JavaScript - closures, promises, async/await, and how the DOM actually updates.", skills: ["html", "css", "javascript"] },
      { title: "Pick a framework and go deep", detail: "Choose one component framework (React, Vue, or Svelte) and build several small, real apps before reaching for a state-management library.", skills: ["react", "vue", "svelte", "typescript"] },
      { title: "State and data fetching", detail: "Learn a query/cache library (React Query, SWR) or a state library (Redux, Zustand), and practice modeling loading, error, and empty states well.", skills: ["react query", "redux", "zustand"] },
      { title: "Tooling and performance", detail: "Get comfortable with a modern bundler (Vite, Webpack), code-splitting, and running a Lighthouse audit end to end - then fix what it flags.", skills: ["vite", "webpack"] },
      { title: "Testing and accessibility", detail: "Add unit tests (Vitest/Jest), component tests (Testing Library), and learn enough ARIA and keyboard-navigation basics to ship accessible UI by default.", skills: ["jest", "vitest", "testing library", "accessibility"] },
    ],
  },
  {
    key: "backend",
    title: "Backend engineering",
    tagline: "APIs, data, and the systems that keep them reliable.",
    steps: [
      { title: "A server-side language", detail: "Get fluent in one backend language (Node.js, Python, Java, or Go) and its standard tooling for packages, testing, and formatting.", skills: ["node.js", "python", "java", "go"] },
      { title: "HTTP APIs done properly", detail: "Build REST (or GraphQL) APIs with real validation, consistent error handling, and versioning - not just happy-path routes.", skills: ["rest", "express", "graphql", "fastapi"] },
      { title: "Databases", detail: "Learn relational modeling and SQL deeply (Postgres/MySQL), then when and why you'd reach for a document or key-value store instead.", skills: ["sql", "postgresql", "mongodb", "redis"] },
      { title: "Auth, security, and rate limiting", detail: "Implement token-based auth (JWT/OAuth), understand common vulnerabilities (injection, XSS, CSRF), and add rate limiting to anything public-facing.", skills: ["jwt", "oauth", "security"] },
      { title: "Observability and reliability", detail: "Add structured logging, health checks, and basic metrics; practice writing code that fails loudly and recovers gracefully instead of crashing silently.", skills: ["logging", "monitoring", "docker"] },
    ],
  },
  {
    key: "data-ml",
    title: "Data & machine learning",
    tagline: "From spreadsheets to models people can trust.",
    steps: [
      { title: "Statistics and Python for data", detail: "Solidify probability, statistics, and the pandas/numpy toolchain - most real ML work is data cleaning and exploration, not modeling.", skills: ["python", "pandas", "numpy", "statistics"] },
      { title: "Classical machine learning", detail: "Learn regression, classification, and tree-based models with scikit-learn, and how to evaluate them properly (cross-validation, the right metric for the problem).", skills: ["scikit-learn", "machine learning"] },
      { title: "Deep learning fundamentals", detail: "Understand neural networks from first principles, then get productive in one framework (PyTorch or TensorFlow).", skills: ["pytorch", "tensorflow", "deep learning"] },
      { title: "Working with modern LLMs", detail: "Learn prompting, embeddings, retrieval-augmented generation, and where an LLM API call is (and isn't) the right tool.", skills: ["llm", "nlp", "rag"] },
      { title: "Shipping models", detail: "Package a model behind an API, monitor it for drift, and practice the full loop from notebook to something a product can actually call.", skills: ["mlops", "docker", "api"] },
    ],
  },
  {
    key: "devops",
    title: "DevOps & cloud",
    tagline: "Making deploys boring, in a good way.",
    steps: [
      { title: "Linux and the shell", detail: "Get fast at the command line, shell scripting, and the basics of processes, permissions, and networking on Linux.", skills: ["linux", "bash"] },
      { title: "Containers", detail: "Learn Docker deeply - images, layers, multi-stage builds - then Docker Compose for multi-service local setups.", skills: ["docker", "docker compose"] },
      { title: "CI/CD", detail: "Build a pipeline (GitHub Actions, GitLab CI) that runs tests and lints on every push, and only deploys what passes.", skills: ["ci/cd", "github actions"] },
      { title: "Cloud fundamentals", detail: "Pick one cloud provider (AWS, GCP, or Azure) and learn its compute, storage, and networking basics before chasing every managed service.", skills: ["aws", "gcp", "azure"] },
      { title: "Infrastructure as code and orchestration", detail: "Learn Terraform (or equivalent) to describe infrastructure declaratively, and get a working understanding of Kubernetes even if you don't run it day to day.", skills: ["terraform", "kubernetes"] },
    ],
  },
  {
    key: "product",
    title: "Product management",
    tagline: "Turning problems worth solving into shipped features.",
    steps: [
      { title: "Problem discovery", detail: "Practice writing a clear problem statement before a solution - user interviews, support tickets, and usage data are your raw material.", skills: ["user research", "product discovery"] },
      { title: "Prioritization frameworks", detail: "Learn a couple of prioritization models (RICE, MoSCoW) and, more importantly, when to override them with judgment.", skills: ["prioritization", "roadmapping"] },
      { title: "Writing specs that ship", detail: "Write specs and acceptance criteria precise enough that an engineer doesn't have to guess what 'done' means.", skills: ["product requirements", "specs"] },
      { title: "Working with data", detail: "Get comfortable defining and reading the metrics that matter (activation, retention, conversion) instead of vanity numbers.", skills: ["analytics", "sql", "a/b testing"] },
      { title: "Cross-functional delivery", detail: "Practice running the loop from spec to launch with design and engineering - status updates, unblocking decisions, and a clean retro afterward.", skills: ["stakeholder management", "agile"] },
    ],
  },
];

export function RoadmapsPage() {
  const [skills, setSkills] = useState<string[] | null>(null);
  const [activeTrack, setActiveTrack] = useState(ROADMAP_TRACKS[0]?.key ?? "frontend");
  useEffect(() => {
    let cancelled = false;
    api.listResumes(1, 1, "")
      .then((result) => {
        const latest = result.data[0];
        return latest ? api.getResume(String(latest.id)) : null;
      })
      .then((resume) => {
        if (!cancelled && resume) setSkills(resume.technical_skills.map((skill) => skill.toLowerCase()));
      })
      .catch(() => { /* roadmaps still work without a resume on file */ });
    return () => { cancelled = true; };
  }, []);
  const track = ROADMAP_TRACKS.find((item) => item.key === activeTrack) ?? ROADMAP_TRACKS[0]!;
  return (
    <AppLayout>
      <PageHeader
        eyebrow="Roadmaps"
        title="Curated learning paths"
        description={skills ? "Steps you already show signal for on your latest resume are marked as covered." : "Sign in and upload a resume to see which steps you already cover."}
      />
      <div className="mt-6 flex flex-wrap gap-2">
        {ROADMAP_TRACKS.map((item) => <FilterChip key={item.key} label={item.title} active={item.key === activeTrack} onClick={() => setActiveTrack(item.key)} />)}
      </div>
      <div className={`${panel} mt-6 p-5 md:p-6`}>
        <div className="font-display text-xl">{track.title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{track.tagline}</p>
        <div className="mt-5 space-y-4">
          {track.steps.map((step, index) => <RoadmapStepRow key={step.title} index={index} step={step} skills={skills} />)}
        </div>
      </div>
    </AppLayout>
  );
}

function RoadmapStepRow({ index, step, skills }: { index: number; step: RoadmapStep; skills: string[] | null }) {
  const covered = skills ? step.skills.some((skill) => skills.some((owned) => owned.includes(skill) || skill.includes(owned))) : false;
  return (
    <div className="flex gap-4">
      <div className={`grid size-8 shrink-0 place-items-center rounded-full border font-display text-sm ${covered ? "border-brass/60 bg-brass/15 text-brass" : "border-border/60 text-muted-foreground"}`}>{covered ? <Check className="size-4" /> : index + 1}</div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{step.title}</h3>{covered && <span className="rounded-full border border-brass/40 bg-brass/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-brass">On your resume</span>}</div>
        <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
      </div>
    </div>
  );
}
