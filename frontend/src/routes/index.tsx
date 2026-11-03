import { createFileRoute } from "@tanstack/react-router";
import { HomeGate } from "../components/resume-app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DeepKlarity — Resume Analyzer" },
      { name: "description", content: "Upload a resume and get a structured, actionable breakdown." },
      { property: "og:title", content: "DeepKlarity — Resume Analyzer" },
      { property: "og:description", content: "Upload a resume and get a structured, actionable breakdown." },
    ],
  }),
  component: HomeGate,
});
