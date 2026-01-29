// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@student": path.resolve(__dirname, "src/student"), // ✅ 추가
    },
  },
  server: {
    host: "localhost",
    port: 5173,
  },
});
