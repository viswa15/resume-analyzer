import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/resumes/$id")({ component: () => <Outlet /> });
