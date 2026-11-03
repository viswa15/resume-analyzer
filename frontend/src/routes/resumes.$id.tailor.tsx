import { createFileRoute } from "@tanstack/react-router";
import { TailorPage } from "../components/tailor-page";

export const Route = createFileRoute("/resumes/$id/tailor")({
  head: () => ({
    meta: [
      { title: "Tailor resume — DeepKlarity" },
      { name: "description", content: "Rewrite your resume for a specific job and download it as a PDF." },
      { property: "og:title", content: "Tailor resume — DeepKlarity" },
      { property: "og:description", content: "Rewrite your resume for a specific job and download it as a PDF." },
    ],
  }),
  component: TailorPage,
});
