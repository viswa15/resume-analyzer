import { createFileRoute } from "@tanstack/react-router";
import { RoadmapsPage } from "../components/resume-app";
export const Route = createFileRoute("/roadmaps")({ head: () => ({ meta: [{ title: "Roadmaps — DeepKlarity" }, { name: "description", content: "Curated learning paths, matched against your resume." }, { property: "og:title", content: "Roadmaps — DeepKlarity" }, { property: "og:description", content: "Curated learning paths, matched against your resume." }] }), component: RoadmapsPage });
