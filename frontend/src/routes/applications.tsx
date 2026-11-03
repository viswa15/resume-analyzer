import { createFileRoute } from "@tanstack/react-router";
import { ApplicationsPage } from "../components/resume-app";
export const Route = createFileRoute("/applications")({ head: () => ({ meta: [{ title: "Applications — DeepKlarity" }, { name: "description", content: "Track every role you're pursuing in one place." }, { property: "og:title", content: "Applications — DeepKlarity" }, { property: "og:description", content: "Track every role you're pursuing in one place." }] }), component: ApplicationsPage });
