import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function fail(message) {
  console.error(`[staff-contract] ${message}`);
  process.exitCode = 1;
}

const api = read("src/app_teacher/domains/staff/api.ts");
const detail = read("src/app_teacher/domains/staff/pages/StaffDetailPage.tsx");
const manage = read("src/app_teacher/domains/staff/pages/StaffManagePage.tsx");

if (/date__year|date__month/.test(api)) {
  fail("mobile staff API must use date_from/date_to, not Django date__year/date__month params.");
}

if (/"pending"\s*\|\s*"approved"\s*\|\s*"rejected"/.test(api + detail)) {
  fail("mobile staff expense statuses must use backend canonical PENDING/APPROVED/REJECTED values.");
}

if (/updateExpenseStatus\([^)]*"(pending|approved|rejected)"/.test(detail)) {
  fail("mobile staff expense status mutations must send uppercase backend values.");
}

if (/deleteWorkMonthLock/.test(detail) || /월 마감 해제/.test(detail)) {
  fail("mobile staff detail must not expose month-lock delete/unlock without a snapshot reversal flow.");
}

if (/password\s*\|\|\s*["']0000["']/.test(manage) || /placeholder=\{[^}]*0000/.test(manage) || /placeholder=["']0000["']/.test(manage)) {
  fail("mobile staff creation must not silently default initial passwords to 0000.");
}

if (process.exitCode) {
  process.exit();
}

console.log("[staff-contract] PASS");
