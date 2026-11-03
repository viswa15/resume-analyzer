import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "../components/resume-app";
export const Route = createFileRoute("/resumes/$id/jobs")({ head: () => ({ meta: [{ title: "Job matches — DeepKlarity" }, { name: "description", content: "Live job postings ranked against your resume's skills." }, { property: "og:title", content: "Job matches — DeepKlarity" }, { property: "og:description", content: "Live job postings ranked against your resume's skills." }] }), component: JobsPage });
