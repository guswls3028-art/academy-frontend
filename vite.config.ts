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
    port: 5174, // run-dev-single.ps1 / Academy Local Dev 와 동일 포트
    strictPort: true, // 5174 사용 중이면 다른 포트로 넘어가지 않고 에러 (중복 실행 방지)
    allowedHosts: [
      "dev-web.hakwonplus.com", // 🔥 Cloudflare 고정 도메인
    ],
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react/") || id.includes("react/jsx")) return "vendor-react";
            if (id.includes("react-router")) return "vendor-router";
            if (id.includes("@tanstack/react-query")) return "vendor-query";
          }
          if (id.includes("/student/") && (id.includes("VideoPlayerPage") || id.includes("playback/player/"))) {
            return "student-video-player";
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },

  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      "@student": path.resolve(process.cwd(), "src/student"),
    },
    dedupe: ["react", "react-dom"],
  },

  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: ["xlsx-js-style"],
  },
});
