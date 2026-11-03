import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "../components/resume-app";
export const Route = createFileRoute("/jobs")({ head: () => ({ meta: [{ title: "Job matches — DeepKlarity" }, { name: "description", content: "Search live job postings for anyone, optionally ranked against one of your resumes." }, { property: "og:title", content: "Job matches — DeepKlarity" }, { property: "og:description", content: "Search live job postings for anyone, optionally ranked against one of your resumes." }] }), component: JobsPage });
