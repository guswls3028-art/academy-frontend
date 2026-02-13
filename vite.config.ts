import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    host: "0.0.0.0", // 🔥 외부 접근 허용 (필수)
    allowedHosts: [
      "dev-web.hakwonplus.com", // 🔥 Cloudflare 고정 도메인
    ],
  },

  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      "@student": path.resolve(process.cwd(), "src/student"),
    },
  },

  // xlsx-js-style 등 Node 'stream' 사용 시 브라우저 호환 경고 완화
  optimizeDeps: {
    exclude: ["xlsx-js-style"],
  },
});
