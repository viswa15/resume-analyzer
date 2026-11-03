import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout, ErrorNote, LoadingState, PageHeader, panel } from "./resume-app";
import { api, type ApplicationStatus, type InsightsData } from "../lib/resume-api";
import { useApiAction } from "../lib/use-api-action";

// One series colour throughout (the app's brass accent); chart chrome stays recessive.
const SERIES = "var(--color-brass)";
const GRID = "var(--border)";
const TICK = { fill: "var(--muted-foreground)", fontSize: 11 };
const SURFACE = "var(--color-panel)";

const shortDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(value));

const FUNNEL_ORDER: { status: ApplicationStatus; label: string }[] = [
  { status: "saved", label: "Saved" },
  { status: "applied", label: "Applied" },
  { status: "interviewing", label: "Interviewing" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

type TipProps = { active?: boolean; payload?: { value?: number | string; payload?: Record<string, unknown> }[]; label?: string | number; unit?: string; title?: (p: Record<string, unknown>) => string };

function ChartTip({ active, payload, unit = "", title }: TipProps) {
  const point = payload?.[0];
  if (!active || !point) return null;
  const heading = title && point.payload ? title(point.payload) : "";
  return (
    <div className="rounded-lg border border-border/70 bg-raise px-3 py-2 text-xs shadow-lg">
      <div className="text-base font-medium text-foreground">{point.value}{unit}</div>
      {heading && <div className="mt-0.5 max-w-56 text-muted-foreground">{heading}</div>}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={`${panel} p-4`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl leading-none text-foreground">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, description, empty, children }: { title: string; description: string; empty: string | null; children: React.ReactNode }) {
  return (
    <section className={`${panel} p-5 md:p-6`}>
      <h2 className="font-display text-lg">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">
        {empty ? <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border/60 px-4 text-center text-sm text-muted-foreground">{empty}</div> : children}
      </div>
    </section>
  );
}

function ScoreLine({ data, max, label, unit }: { data: { date: string; value: number; name: string }[]; max: number; label: string; unit: string }) {
  return (
    <div role="img" aria-label={label} className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
          <YAxis domain={[0, max]} ticks={max === 10 ? [0, 2, 4, 6, 8, 10] : [0, 25, 50, 75, 100]} tick={TICK} tickLine={false} axisLine={false} width={36} />
          <Tooltip cursor={{ stroke: GRID }} content={<ChartTip unit={unit} title={(p) => `${String(p["name"] ?? "")} · ${String(p["date"] ?? "")}`} />} />
          <Line type="monotone" dataKey="value" stroke={SERIES} strokeWidth={2} dot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 6, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HBars({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  return (
    <div role="img" aria-label={label} style={{ height: Math.max(120, data.length * 34 + 16) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ ...TICK, fontSize: 12 }} tickLine={false} axisLine={false} width={96} />
          <Tooltip cursor={{ fill: "var(--color-raise)" }} content={<ChartTip />} />
          <Bar dataKey="value" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} label={{ position: "right", fill: "var(--foreground)", fontSize: 12 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const rate = (value: number | null) => (value === null ? "—" : `${value}%`);

export function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const load = useApiAction(api.insights);

  useEffect(() => {
    load.run().then(setData).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ratings = (data?.resumeRatings ?? []).map((r) => ({ date: shortDate(r.uploaded_at), value: r.resume_rating, name: r.file_name }));
  const matches = (data?.matchHistory ?? []).map((m) => ({ date: shortDate(m.created_at), value: m.match_score, name: m.job_snippet || m.file_name }));
  const avgMatch = matches.length ? Math.round(matches.reduce((sum, m) => sum + m.value, 0) / matches.length) : null;
  const bestRating = ratings.length ? Math.max(...ratings.map((r) => r.value)) : null;
  const apps = data?.applications;
  const funnel = FUNNEL_ORDER.map(({ status, label }) => ({ name: label, value: apps?.byStatus[status] ?? 0 }));
  const missing = (data?.topMissingKeywords ?? []).map((k) => ({ name: k.keyword, value: k.count }));
  const weekly = (apps?.weekly ?? []).map((w) => ({ name: shortDate(w.week), value: w.count }));

  return (
    <AppLayout>
      <PageHeader eyebrow="Insights" title="Your progress at a glance" description="Score trends, recurring skill gaps and your application funnel. Built from your own history, with no extra AI calls." />
      <div className="mt-6 space-y-4">
        <ErrorNote message={load.error} />
        {!data && !load.error && <LoadingState label="Crunching your history…" />}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Resumes analysed" value={String(ratings.length)} hint={bestRating !== null ? `Best rating ${bestRating}/10` : "Upload one to begin"} />
              <Tile label="JD matches run" value={String(matches.length)} hint={avgMatch !== null ? `Average score ${avgMatch}/100` : "None yet"} />
              <Tile label="Applications" value={String(apps?.total ?? 0)} hint={`${apps?.submitted ?? 0} submitted`} />
              <Tile label="Response rate" value={rate(apps?.responseRate ?? null)} hint={`Interview rate ${rate(apps?.interviewRate ?? null)}`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Resume rating over uploads" description="Each dot is one analysed resume. Re-upload after edits to see whether the rating improves." empty={ratings.length < 2 ? "Upload at least two resumes to see a trend." : null}>
                <ScoreLine data={ratings} max={10} label="Line chart of resume ratings out of 10 across uploads" unit="/10" />
              </ChartCard>
              <ChartCard title="JD match scores over time" description="Every job description you score is recorded, so you can see your fit improving." empty={matches.length < 2 ? "Run at least two JD matches to see a trend." : null}>
                <ScoreLine data={matches} max={100} label="Line chart of JD match scores out of 100 over time" unit="/100" />
              </ChartCard>
              <ChartCard title="Skills you are most often missing" description="Keywords that keep showing up as gaps across your JD matches. Good candidates to learn or add." empty={missing.length === 0 ? "Run a JD match to start collecting skill gaps." : null}>
                <HBars data={missing} label="Bar chart of the most frequently missing skills" />
              </ChartCard>
              <ChartCard title="Application funnel" description="How many applications sit at each stage." empty={(apps?.total ?? 0) === 0 ? "Track an application to see your funnel." : null}>
                <HBars data={funnel} label="Bar chart of applications by stage" />
              </ChartCard>
            </div>

            <ChartCard title="Applications per week" description="Roles you added over the last eight weeks." empty={weekly.length === 0 ? "No applications added in the last eight weeks." : null}>
              <HBars data={weekly} label="Bar chart of applications added per week" />
            </ChartCard>

            {matches.length > 0 && (
              <section className={`${panel} p-5 md:p-6`}>
                <h2 className="font-display text-lg">Recent matches</h2>
                <div className="mt-3 divide-y divide-border/60">
                  {[...(data.matchHistory)].reverse().slice(0, 8).map((m) => (
                    <Link key={m.id} to="/resumes/$id/match" params={{ id: String(m.resume_id) }} className="flex items-center justify-between gap-4 py-2.5 text-sm hover:text-foreground">
                      <span className="min-w-0"><span className="block truncate">{m.job_snippet || "Job description"}</span><span className="block text-xs text-muted-foreground">{m.file_name} · {shortDate(m.created_at)}</span></span>
                      <span className="shrink-0 font-display text-lg">{m.match_score}<span className="text-xs text-muted-foreground">/100</span></span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
