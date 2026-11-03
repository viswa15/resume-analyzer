import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Optional build-time deploy target ("vercel", "netlify", "node-server", ...).
// Leave it unset to let Nitro pick a preset from the hosting environment.
const deployTarget = process.env["DEPLOY_TARGET"];

export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
  plugins: [
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Route SSR through src/server.ts so unhandled errors render a friendly page.
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build" ? [nitro(deployTarget ? { preset: deployTarget } : {})] : []),
    react(),
  ],
}));
