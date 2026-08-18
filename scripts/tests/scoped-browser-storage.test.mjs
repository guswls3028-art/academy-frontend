import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(absolutePath);
    if (!/\.(?:ts|tsx)$/.test(entry.name)) return [];
    return [path.relative(root, absolutePath).replaceAll(path.sep, "/")];
  });
}

const rawStorageOwners = new Set([
  "src/shared/tenant/index.ts",
  "src/shared/api/axios.ts",
  "src/auth/api/auth.api.ts",
  "src/auth/context/AuthContext.tsx",
  "src/app_dev/shared/components/impersonationSession.ts",
  "src/app_dev/shared/components/ImpersonationBanner.tsx",
  "src/app_dev/shared/components/CommandPalette.tsx",
  "src/app_dev/domains/tenants/pages/TenantOwnersTab.tsx",
]);

test("tenant-user storage keys fail closed when either identity is absent", () => {
  const source = read("src/shared/utils/safeLocalStorage.ts");
  assert.match(source, /getTenantCodeForApiRequest\(\)/);
  assert.match(source, /getTenantUserLocalKey/);
  assert.match(source, /getTenantUserLocalItem/);
  assert.match(source, /setTenantUserLocalItem/);
  assert.match(source, /removeTenantUserLocalItem/);
  assert.match(source, /scopedKey && normalizedUserId/);
  assert.match(source, /return scopedKey \? getLocalItem\(scopedKey\) : null/);
});

test("only bootstrap and authentication owners may access raw localStorage", () => {
  const directStorageAccess = /(?:window\.)?localStorage\.(?:getItem|setItem|removeItem)\s*\(/;
  const directOwners = collectSourceFiles(path.join(root, "src"))
    .filter((owner) => directStorageAccess.test(read(owner)))
    .sort();

  assert.deepEqual(directOwners, [...rawStorageOwners].sort());
});

test("preview API tenant resolution uses path then explicit env without storage fallback", () => {
  const source = read("src/shared/tenant/index.ts");
  const previewStart = source.indexOf("if (isPreview) {");
  const previewEnd = source.indexOf("\n    const fromHost =", previewStart);

  assert.notEqual(previewStart, -1);
  assert.notEqual(previewEnd, -1);

  const previewBlock = source.slice(previewStart, previewEnd);
  assert.match(previewBlock, /if \(fromPath\)[\s\S]*return fromPath;/);
  assert.match(
    previewBlock,
    /const fromEnv = getTenantCodeFromEnv\(\);[\s\S]*if \(fromEnv\) return fromEnv;/,
  );
  assert.ok(previewBlock.indexOf("return fromPath") < previewBlock.indexOf("const fromEnv"));
  assert.doesNotMatch(previewBlock, /sessionStorage\.getItem/);
});

test("authored drafts and operational preferences use tenant-aware storage", () => {
  const sensitiveOwners = [
    "src/landing/pages/LandingCommunityWritePage.tsx",
    "src/app_admin/domains/storage/components/matchup/HitReportEditor.tsx",
    "src/app_admin/domains/storage/components/matchup/DocumentUploadModal.tsx",
    "src/app_admin/domains/storage/pages/MatchupPage.tsx",
    "src/app_student/domains/video/pages/VideoPlayerPage.tsx",
    "src/app_student/domains/video/pages/SessionDetailPage.tsx",
    "src/app_admin/domains/scores/hooks/useScoreEditDraft.ts",
    "src/shared/ui/assessment/useAssessmentPolicyDraft.ts",
    "src/app_student/domains/exams/pages/ExamSubmitPage.tsx",
  ];
  const directStorageAccess = /(?:window\.)?localStorage\.(?:getItem|setItem|removeItem)\s*\(/;

  for (const owner of sensitiveOwners) {
    const source = read(owner);
    assert.doesNotMatch(source, directStorageAccess, `${owner} must use the scoped storage owner`);
    assert.match(
      source,
      /safeLocalStorage|videoPlaybackStorage/,
      `${owner} must import the scoped storage owner`,
    );
  }
});
