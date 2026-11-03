import { createFileRoute } from "@tanstack/react-router";
import { CoverLetterPage } from "../components/resume-app";
export const Route = createFileRoute("/resumes/$id/cover-letter")({ head: () => ({ meta: [{ title: "Cover letter — DeepKlarity" }, { name: "description", content: "Draft a tailored cover letter grounded in your resume." }, { property: "og:title", content: "Cover letter — DeepKlarity" }, { property: "og:description", content: "Draft a tailored cover letter grounded in your resume." }] }), component: CoverLetterPage });
