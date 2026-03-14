import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import agentEventServer from "./vite-plugins/agentEventServer";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    agentEventServer(),
  ],

  server: {
    host: "0.0.0.0", // 🔥 외부 접근 허용 (필수)
    port: 5174, // run-dev-single.ps1 / Academy Local Dev 와 동일 포트
    strictPort: true, // 5174 사용 중이면 다른 포트로 넘어가지 않고 에러 (중복 실행 방지)
    allowedHosts: [
      "dev-web.hakwonplus.com", // 🔥 Cloudflare 고정 도메인
    ],
    // 로컬 개발 시 API를 백엔드(academy)로 프록시. 백엔드가 먼저 localhost:8000 에서 기동되어 있어야 함.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },

  build: {
    target: ["es2020", "chrome92", "edge92", "safari14", "firefox90"],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // React + react-router는 반드시 같은 청크에 (createContext 등 의존)
            if (
              id.includes("react-dom") ||
              id.includes("react/") ||
              id.includes("react/jsx") ||
              id.includes("react-router")
            ) {
              return "vendor-core";
            }
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
