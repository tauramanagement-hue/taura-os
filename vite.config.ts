import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] as const;
  for (const key of required) {
    if (!env[key] && !process.env[key]) {
      throw new Error(
        `Missing required env var: ${key}. Set it in .env.local (dev) or in your deployment environment.`,
      );
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
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
