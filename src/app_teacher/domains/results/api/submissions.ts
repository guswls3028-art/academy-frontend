// PATH: src/app_teacher/domains/results/api/submissions.ts
// Compatibility facade. Canonical submission API contract lives in shared.
export { fetchPendingSubmissions } from "@/shared/api/contracts/submissions";
export type { PendingSubmissionRow, SubmissionStatus } from "@/shared/api/contracts/submissions";
