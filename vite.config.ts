import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "https://zywifoacnzpnuvhjlmzj.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_NVAytJjx072gt-WgNJ2qKA_K-brBZu_",
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5d2lmb2FjbnpwbnV2aGpsbXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTYzNTMsImV4cCI6MjA4Nzk3MjM1M30.-MmwWm7f-ylItxDuxLYQ27bNMlAEko2hmwFlE-sdc9E",
  };

  return {
    define: {
      __VITE_SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL),
      __VITE_SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY),
      __VITE_SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
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
