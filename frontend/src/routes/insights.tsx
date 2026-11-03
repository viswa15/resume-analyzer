import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage } from "../components/insights-page";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — DeepKlarity" },
      { name: "description", content: "Track resume scores, skill gaps and your application funnel over time." },
      { property: "og:title", content: "Insights — DeepKlarity" },
      { property: "og:description", content: "Track resume scores, skill gaps and your application funnel over time." },
    ],
  }),
  component: InsightsPage,
});
