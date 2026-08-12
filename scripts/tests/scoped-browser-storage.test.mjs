import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("tenant-user storage keys fail closed when either identity is absent", () => {
  const source = read("src/shared/utils/safeLocalStorage.ts");
  assert.match(source, /getTenantCodeForApiRequest\(\)/);
  assert.match(source, /getTenantUserLocalKey/);
  assert.match(source, /scopedKey && normalizedUserId/);
  assert.match(source, /return scopedKey \? getLocalItem\(scopedKey\) : null/);
});

test("authored drafts and operational preferences cannot bypass scoped storage", () => {
  const sensitiveOwners = [
    "src/landing/pages/LandingCommunityWritePage.tsx",
    "src/app_admin/domains/storage/components/matchup/HitReportEditor.tsx",
    "src/app_admin/domains/storage/components/matchup/DocumentUploadModal.tsx",
    "src/app_admin/domains/storage/pages/MatchupPage.tsx",
    "src/app_student/domains/video/pages/VideoPlayerPage.tsx",
    "src/app_student/domains/video/pages/SessionDetailPage.tsx",
  ];
  const directStorageAccess = /(?:window\.)?localStorage\.(?:getItem|setItem|removeItem)\s*\(/;

  for (const owner of sensitiveOwners) {
    const source = read(owner);
    assert.doesNotMatch(source, directStorageAccess, `${owner} must use the scoped storage owner`);
    assert.match(source, /safeLocalStorage|videoPlaybackStorage/, `${owner} must import the scoped storage owner`);
  }
});
