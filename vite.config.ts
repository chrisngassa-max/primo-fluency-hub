import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || "https://gudcenhmzlcvhgbgklzw.supabase.co";
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_z1FGsdO6Zql1fcfVud3gZg_YSLzjaHW";
  // Derive Supabase project ref from the URL — required by the MCP OAuth issuer.
  const projectRef =
    env.VITE_SUPABASE_PROJECT_ID ||
    (supabaseUrl.match(/^https?:\/\/([^.]+)\.supabase\.co/i)?.[1] ?? "project-ref-unset");

  const plugins: PluginOption[] = [react()];

  // Lovable MCP plugin — dev sandbox only; package lives on a private registry unavailable on Vercel.
  if (!process.env.VERCEL) {
    try {
      const { mcpPlugin } = await import("@lovable.dev/mcp-js/stacks/supabase/vite");
      plugins.push(mcpPlugin());
    } catch {
      // Package absent outside Lovable sandbox — safe to skip for CI/Vercel builds.
    }
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(projectRef),
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
