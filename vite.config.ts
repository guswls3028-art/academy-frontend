import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import agentEventServer from "./vite-plugins/agentEventServer";

function versionJsonPlugin(buildVersion: string) {
  return {
    name: "version-json",
    apply: "build" as const,
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: buildVersion }),
      });
    },
  };
}

function resolveBuildVersion(): string {
  // GitHub Actions and Cloudflare Pages can both build the same main commit.
  // A wall-clock version makes those otherwise identical builds produce
  // different entry/lazy chunk hashes, so whichever deployment finishes last
  // can invalidate the other one's assets. Platform commit identifiers take
  // precedence so a stale dashboard override cannot break this invariant.
  for (const candidate of [
    process.env.CF_PAGES_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.VITE_BUILD_VERSION,
  ]) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return Date.now().toString();
}

const buildVersion = resolveBuildVersion();
const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || "http://localhost:8000";

export default defineConfig({
  define: {
    // Keep the historical global name while using a deterministic build ID.
    __BUILD_TIMESTAMP__: JSON.stringify(buildVersion),
  },

  plugins: [
    react(),
    tailwindcss(),
    agentEventServer(),
    versionJsonPlugin(buildVersion),
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
        target: devProxyTarget,
        changeOrigin: true,
      },
    },
  },

  build: {
    target: ["es2020", "chrome92", "edge92", "safari14", "firefox90"],
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.endsWith(".css")) return undefined;
          if (id.includes("node_modules")) {
            // React + react-router는 반드시 같은 청크에 (createContext 등 의존)
            if (
              normalized.includes("/node_modules/react/") ||
              normalized.includes("/node_modules/react-dom/") ||
              normalized.includes("/node_modules/react-router/") ||
              normalized.includes("/node_modules/react-router-dom/") ||
              normalized.includes("/node_modules/scheduler/") ||
              normalized.includes("react/jsx")
            ) {
              return "vendor-core";
            }
            if (normalized.includes("@tanstack/react-query")) return "vendor-query";
            if (
              normalized.includes("/antd/") ||
              normalized.includes("@ant-design/") ||
              normalized.includes("/rc-") ||
              normalized.includes("@rc-component/")
            ) return "vendor-antd";
            if (normalized.includes("lucide-react") || normalized.includes("react-icons")) return "vendor-icons";
            if (normalized.includes("recharts") || normalized.includes("/d3-")) return "vendor-charts";
            if (normalized.includes("/exceljs/")) return "vendor-excel";
            if (normalized.includes("pdfjs-dist")) return "vendor-pdfjs";
            if (normalized.includes("pdf-lib")) return "vendor-pdf-lib";
            if (normalized.includes("hls.js")) return "vendor-hls";
            if (
              normalized.includes("@tiptap/") ||
              normalized.includes("/prosemirror-") ||
              normalized.includes("dompurify")
            ) return "vendor-editor";
            if (normalized.includes("heic2any")) return "vendor-heic";
            if (normalized.includes("@sentry/")) return "vendor-observability";
            if (normalized.includes("axios") || normalized.includes("dayjs")) return "vendor-utils";
          }
          // 테넌트 레지스트리: 앱 초기화 시 hostname→tenant 매핑 필수 — 메인 entry와 동일 청크
          if (normalized.includes("shared/tenant")) {
            return "index";
          }
          return undefined;
        },
      },
    },
    // HEIC conversion is a lazy, user-triggered vendor chunk; keep warnings focused on unexpected route bundles.
    chunkSizeWarningLimit: 1400,
  },

  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      "@admin": path.resolve(process.cwd(), "src/app_admin"),
      "@student": path.resolve(process.cwd(), "src/app_student"),
      "@dev": path.resolve(process.cwd(), "src/app_dev"),
      "@promo": path.resolve(process.cwd(), "src/app_promo"),
      "@teacher": path.resolve(process.cwd(), "src/app_teacher"),
    },
    dedupe: ["react", "react-dom"],
  },

  optimizeDeps: {
    include: ["react", "react-dom"],
  },
});
