import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const featurePath = path.join(
  root,
  "src/shared/productAnalytics/featureRegistry.ts",
);
const routePath = path.join(
  root,
  "src/shared/productAnalytics/routeRegistry.ts",
);
const providerPath = path.join(
  root,
  "src/shared/productAnalytics/ProductAnalyticsProvider.tsx",
);
const placementPaths = [
  "src/app_admin/layout/Sidebar.tsx",
  "src/app_admin/layout/AdminNavDrawer.tsx",
  "src/app_admin/layout/TeacherBottomBar.tsx",
  "src/app_teacher/layout/TeacherTabBar.tsx",
  "src/app_teacher/layout/TeacherDrawer.tsx",
  "src/app_student/layout/StudentTabBar.tsx",
  "src/app_student/layout/StudentDrawer.tsx",
].map((relativePath) => path.join(root, relativePath));
const featureSource = fs.readFileSync(featurePath, "utf8");
const routeSource = fs.readFileSync(routePath, "utf8");
const providerSource = fs.readFileSync(providerPath, "utf8");
const placementSource = placementPaths
  .map((filePath) => fs.readFileSync(filePath, "utf8"))
  .join("\n");

const featureIds = [
  ...featureSource.matchAll(/featureId:\s*"([^"]+)"/g),
].map((match) => match[1]);
const routeRows = [
  ...routeSource.matchAll(
    /route\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)/g,
  ),
].map((match) => ({
  routeTemplate: match[1],
  featureId: match[2],
  screenId: match[3],
  surface: match[4],
}));

const errors = [];
const duplicateValues = (values) => values.filter(
  (value, index) => values.indexOf(value) !== index,
);
for (const duplicate of new Set(duplicateValues(featureIds))) {
  errors.push(`duplicate featureId: ${duplicate}`);
}
for (const duplicate of new Set(
  duplicateValues(routeRows.map((row) => row.routeTemplate)),
)) {
  errors.push(`duplicate routeTemplate: ${duplicate}`);
}

const allowedId = /^[a-z0-9][a-z0-9.-]*$/;
for (const featureId of featureIds) {
  if (!allowedId.test(featureId)) errors.push(`invalid featureId: ${featureId}`);
}
for (const row of routeRows) {
  if (!featureIds.includes(row.featureId)) {
    errors.push(`unknown route featureId: ${row.featureId}`);
  }
  if (!allowedId.test(row.screenId)) {
    errors.push(`invalid screenId: ${row.screenId}`);
  }
  if (!["admin", "teacher", "student"].includes(row.surface)) {
    errors.push(`invalid surface: ${row.surface}`);
  }
  if (/[?#]/.test(row.routeTemplate)) {
    errors.push(`query/hash in routeTemplate: ${row.routeTemplate}`);
  }
  if (
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
      .test(row.routeTemplate)
  ) {
    errors.push(`raw uuid in routeTemplate: ${row.routeTemplate}`);
  }
}

if (featureIds.length === 0) errors.push("no product features found");
if (routeRows.length === 0) errors.push("no product routes found");
if (!routeRows.some((row) => row.routeTemplate === "/workspace/mobile")) {
  errors.push("canonical mobile workspace route is missing");
}
if (!routeRows.some((row) => row.routeTemplate === "/workspace/dashboard")) {
  errors.push("canonical full workspace route is missing");
}
if (!routeSource.includes('pathname.startsWith("/admin/")')) {
  errors.push("legacy full-workspace route normalization is missing");
}
if (!routeSource.includes('pathname.startsWith("/teacher/")')) {
  errors.push("legacy mobile-workspace route normalization is missing");
}
if (!providerSource.includes("[data-analytics-destination]")) {
  errors.push("button navigation destinations are not observed");
}
const placementIds = [
  ...placementSource.matchAll(/data-analytics-placement="([^"]+)"/g),
].map((match) => match[1]);
if (placementIds.length < placementPaths.length) {
  errors.push("a primary role navigation placement is missing");
}
for (const placementId of placementIds) {
  if (!allowedId.test(placementId)) {
    errors.push(`invalid placementId: ${placementId}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(
  `product analytics registry OK: ${featureIds.length} features, `
  + `${routeRows.length} routes`,
);
