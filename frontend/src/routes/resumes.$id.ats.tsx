import { createFileRoute } from "@tanstack/react-router";
import { AtsPage } from "../components/ats-page";

export const Route = createFileRoute("/resumes/$id/ats")({
  head: () => ({
    meta: [
      { title: "ATS check — DeepKlarity" },
      { name: "description", content: "Rule-based ATS readiness check for your resume." },
      { property: "og:title", content: "ATS check — DeepKlarity" },
      { property: "og:description", content: "Rule-based ATS readiness check for your resume." },
    ],
  }),
  component: AtsPage,
});
