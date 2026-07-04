import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || "https://gudcenhmzlcvhgbgklzw.supabase.co";
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_z1FGsdO6Zql1fcfVud3gZg_YSLzjaHW";
  // Derive Supabase project ref from the URL — required by the MCP OAuth issuer.
  const projectRef =
    env.VITE_SUPABASE_PROJECT_ID ||
    (supabaseUrl.match(/^https?:\/\/([^.]+)\.supabase\.co/i)?.[1] ?? "project-ref-unset");

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
    plugins: [react(), mcpPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
