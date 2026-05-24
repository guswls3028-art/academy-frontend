#!/usr/bin/env node
/**
 * 학생앱 라우트 검증 — StudentRouter에서 lazy/import 로드하는 모든 페이지 파일이 존재하는지 확인.
 */

import path from "path";
import { fileURLToPath } from "url";
import { verifyLazyRouteImports } from "./verify-lazy-route-imports.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

verifyLazyRouteImports({
  label: "student app",
  routerFile: path.join(root, "src", "app_student", "app", "StudentRouter.tsx"),
});
