import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowRight, Download, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, ErrorNote, PageHeader, panel, quietButton } from "./resume-app";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { api, type TailorResult } from "../lib/resume-api";
import { useApiAction } from "../lib/use-api-action";

function Delta({ label, before, after, suffix }: { label: string; before: number | null; after: number | null; suffix: string }) {
  const diff = before !== null && after !== null ? after - before : null;
  return (
    <div className={`${panel} p-4`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-2 font-display text-3xl leading-none">
        <span className="text-muted-foreground">{before === null ? "—" : `${before}${suffix}`}</span>
        <ArrowRight className="size-4 text-muted-foreground" />
        <span>{after === null ? "—" : `${after}${suffix}`}</span>
      </div>
      {diff !== null && (
        <div className="mt-2 text-xs text-muted-foreground">
          {diff > 0 ? `Up ${diff} points` : diff < 0 ? `Down ${Math.abs(diff)} points` : "No change"}
        </div>
      )}
    </div>
  );
}

export function TailorPage() {
  const { id } = useParams({ strict: false });
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<TailorResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const tailor = useApiAction(api.tailorResume);

  const submit = async () => {
    if (!id || description.trim().length < 30) return;
    try {
      setResult(await tailor.run(id, description.trim()));
    } catch {
      /* surfaced inline */
    }
  };

  const download = async () => {
    if (!id || !result) return;
    setDownloading(true);
    try {
      const blob = await api.downloadTailoredPdf(id, result.document);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const base = (result.document.contact.name || "resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "resume";
      link.href = url;
      link.download = `${base}-tailored.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Couldn't create the PDF. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const doc = result?.document;
  const cmp = result?.comparison;

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Tailor"
        title="Rewrite your resume for one role"
        description="Paste a job description. The assistant rewords your existing experience to match it, without inventing anything, and you download the result as a PDF."
        actions={
          id ? (
            <Button asChild variant="outline" className={quietButton}>
              <Link to="/resumes/$id" params={{ id }}>Back to dossier</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className={`${panel} p-5 md:p-6`}>
          <div className="flex items-center justify-between">
            <div className="font-display text-lg">Job description</div>
            <span className="text-xs text-muted-foreground">Minimum 30 characters</span>
          </div>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Paste the role, responsibilities, and requirements here…"
            className="mt-4 min-h-72 border-border/70 bg-raise/40"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={submit} disabled={description.trim().length < 30 || tailor.loading} className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt">
              <WandSparkles />
              {tailor.loading ? "Tailoring…" : "Tailor my resume"}
            </Button>
          </div>
          <div className="mt-3">
            <ErrorNote message={tailor.error} />
          </div>
        </section>

        <section className="space-y-4">
          {!doc || !cmp ? (
            <div className={`${panel} flex min-h-64 items-center justify-center p-6 text-center`}>
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-full border border-brass/25 text-brass"><WandSparkles /></div>
                <h2 className="mt-4 font-display text-xl">Your tailored resume will appear here.</h2>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  Your name, contact details, employers and dates always come from your original resume. Only the wording changes.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Delta label="Keyword coverage" before={cmp.before.keywordPercent} after={cmp.after.keywordPercent} suffix="%" />
                <Delta label="ATS readiness" before={cmp.before.atsScore} after={cmp.after.atsScore} suffix="" />
              </div>
              <p className="text-xs text-muted-foreground">
                Both scores come from the built-in rule-based checker, comparing your original resume text with the rewritten version.
              </p>

              {doc.changes && doc.changes.length > 0 && (
                <section className={`${panel} p-5`}>
                  <h2 className="font-display text-lg">What changed</h2>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {doc.changes.map((change) => (
                      <li key={change} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-brass/70" />{change}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section className={`${panel} p-5 md:p-6`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl">{doc.contact.name || "Your resume"}</h2>
                    {doc.headline && <p className="text-sm text-muted-foreground">{doc.headline}</p>}
                  </div>
                  <Button onClick={download} disabled={downloading} className="rounded-full bg-brass text-primary-foreground hover:bg-brass-lt">
                    <Download />
                    {downloading ? "Preparing…" : "Download PDF"}
                  </Button>
                </div>
                {doc.summary && <p className="mt-4 text-sm">{doc.summary}</p>}
                <div className="mt-5 space-y-4">
                  {doc.work_experience.map((job, index) => (
                    <div key={`${job.company}-${index}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-medium">{job.role}</div>
                        <div className="text-xs text-muted-foreground">{job.company} · {job.duration}</div>
                      </div>
                      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                        {job.bullets.map((bullet, i) => (
                          <li key={`${bullet}-${i}`} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-brass/70" />{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {doc.skills.length > 0 && (
                  <div className="mt-5">
                    <h3 className="font-display text-base">Skills</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {doc.skills.map((skill) => (
                        <span key={skill} className="rounded-full border border-border bg-raise/50 px-3 py-1 text-xs text-muted-foreground">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-5 text-xs text-muted-foreground">
                  Read every line before you send it. The assistant only rewords, but you know your history best.
                </p>
              </section>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
