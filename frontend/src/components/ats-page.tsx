import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ScanSearch, XCircle } from "lucide-react";
import { AppLayout, ErrorNote, LoadingState, PageHeader, ScoreGauge, panel, quietButton } from "./resume-app";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { api, type AtsCheckStatus, type AtsReport } from "../lib/resume-api";
import { useApiAction } from "../lib/use-api-action";

const STATUS_STYLE: Record<AtsCheckStatus, { icon: React.ReactNode; className: string; label: string }> = {
  pass: { icon: <CheckCircle2 className="size-4" />, className: "text-emerald-400", label: "Pass" },
  warn: { icon: <AlertTriangle className="size-4" />, className: "text-amber-400", label: "Needs work" },
  fail: { icon: <XCircle className="size-4" />, className: "text-destructive", label: "Fix this" },
};

function Chips({ items, tone }: { items: string[]; tone: "good" | "bad" }) {
  if (!items.length) return <p className="mt-2 text-sm text-muted-foreground">None.</p>;
  const cls = tone === "good" ? "border-emerald-400/30 text-emerald-300" : "border-destructive/40 text-destructive-foreground";
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full border bg-raise/50 px-3 py-1 text-xs ${cls}`}>{item}</span>
      ))}
    </div>
  );
}

export function AtsPage() {
  const { id } = useParams({ strict: false });
  const [report, setReport] = useState<AtsReport | null>(null);
  const [description, setDescription] = useState("");
  const check = useApiAction(api.atsCheck);

  useEffect(() => {
    if (!id) return;
    check.run(id).then(setReport).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runWithJd = async () => {
    if (!id || description.trim().length < 30) return;
    try {
      setReport(await check.run(id, description.trim()));
    } catch {
      /* surfaced inline */
    }
  };

  return (
    <AppLayout>
      <PageHeader
        eyebrow="ATS check"
        title="Will an ATS read your resume?"
        description="Instant, rule-based checks on structure, wording and keywords. No AI call, so it never uses your quota."
        actions={
          id ? (
            <Button asChild variant="outline" className={quietButton}>
              <Link to="/resumes/$id" params={{ id }}>Back to dossier</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mt-6 space-y-4">
        <ErrorNote message={check.error} />
        {!report && !check.error && <LoadingState label="Checking your resume…" />}
        {report && (
          <>
            <section className={`${panel} flex flex-wrap items-center justify-between gap-6 p-5 md:p-6`}>
              <div className="flex items-center gap-5">
                <ScoreGauge value={report.score} max={100} size={132} sublabel={`${report.checks.filter((c) => c.status !== "pass").length} issue${report.checks.filter((c) => c.status !== "pass").length === 1 ? "" : "s"}`} />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">ATS readiness</div>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">Instant, rule-based checks on structure, wording and keywords.</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Grade</div>
                <div className="font-display text-6xl leading-none">{report.grade}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {report.stats.wordCount} words · {report.stats.bulletCount} bullets
                </div>
              </div>
            </section>

            <section className={`${panel} divide-y divide-border/60`}>
              {report.checks.map((item) => {
                const style = STATUS_STYLE[item.status];
                return (
                  <div key={item.id} className="flex gap-3 p-4 md:px-6">
                    <span className={`mt-0.5 shrink-0 ${style.className}`}>{style.icon}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">{item.label}</span>
                        <span className={`text-xs ${style.className}`}>{style.label}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className={`${panel} p-5 md:p-6`}>
              <h2 className="font-display text-lg">Keyword coverage for a specific job</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste a job description to see which of its skills your resume already mentions.
              </p>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Paste the job description here…"
                className="mt-4 min-h-40 border-border/70 bg-raise/40"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={runWithJd}
                  disabled={description.trim().length < 30 || check.loading}
                  className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt"
                >
                  <ScanSearch />
                  {check.loading ? "Checking…" : "Check keywords"}
                </Button>
              </div>
              {report.keywordCoverage && (
                <div className="mt-5 space-y-4">
                  {report.keywordCoverage.percent === null ? (
                    <p className="text-sm text-muted-foreground">
                      No recognised skills were found in that job description, so there is nothing to compare.
                    </p>
                  ) : (
                    <>
                      <div className="font-display text-3xl text-brass-lt">
                        {report.keywordCoverage.percent}%
                        <span className="ml-2 text-sm text-muted-foreground">
                          of {report.keywordCoverage.requested} requested skills are on your resume
                        </span>
                      </div>
                      <div>
                        <h3 className="font-display text-base">Covered</h3>
                        <Chips items={report.keywordCoverage.matched} tone="good" />
                      </div>
                      <div>
                        <h3 className="font-display text-base">Missing</h3>
                        <Chips items={report.keywordCoverage.missing} tone="bad" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
