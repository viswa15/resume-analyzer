import { createFileRoute } from "@tanstack/react-router";
import { ResumeDetailPage } from "../components/resume-app";
export const Route = createFileRoute("/resumes/$id/")({ head: () => ({ meta: [{ title: "Resume dossier — DeepKlarity" }, { name: "description", content: "Review the full structured analysis for a resume." }, { property: "og:title", content: "Resume dossier — DeepKlarity" }, { property: "og:description", content: "Review the full structured analysis for a resume." }] }), component: ResumeDetailPage });
