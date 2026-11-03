import { createFileRoute } from "@tanstack/react-router";
import { GuidePage } from "../components/resume-app";
export const Route = createFileRoute("/guide")({ head: () => ({ meta: [{ title: "Guide — DeepKlarity Resume Analyzer" }, { name: "description", content: "How DeepKlarity's four AI features fit together." }, { property: "og:title", content: "Guide — DeepKlarity Resume Analyzer" }, { property: "og:description", content: "How DeepKlarity's four AI features fit together." }] }), component: GuidePage });
