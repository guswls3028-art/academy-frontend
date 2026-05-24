#!/usr/bin/env node
/**
 * 관리자앱 라우트 검증 — AdminRouter에서 lazy/import 로드하는 모든 페이지 파일이 존재하는지 확인.
 */

import path from "path";
import { fileURLToPath } from "url";
import { verifyLazyRouteImports } from "./verify-lazy-route-imports.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const ROUTERS = [
  ["admin app", path.join(root, "src", "app_admin", "app", "AdminRouter.tsx")],
  ["admin clinic", path.join(root, "src", "app_admin", "domains", "clinic", "ClinicRoutes.tsx")],
  ["admin materials", path.join(root, "src", "app_admin", "domains", "materials", "MaterialsRoutes.tsx")],
  ["admin messages", path.join(root, "src", "app_admin", "domains", "messages", "MessagesRoutes.tsx")],
  ["admin staff", path.join(root, "src", "app_admin", "domains", "staff", "StaffRoutes.tsx")],
  ["admin storage", path.join(root, "src", "app_admin", "domains", "storage", "StorageRoutes.tsx")],
  ["admin tools", path.join(root, "src", "app_admin", "domains", "tools", "ToolsRoutes.tsx")],
];

for (const [label, routerFile] of ROUTERS) {
  verifyLazyRouteImports({ label, routerFile });
}
