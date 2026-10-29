import api, { type ApiRequestConfig } from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore, MAX_STORED_RESULT_ROWS } from "./asyncStatusStore";

/** The workbox owns tenant/auth generations, request cancellation and in-flight deduplication. */
export type ExcelJobPollContext = {
  requestConfig: ApiRequestConfig;
  isCurrent: () => boolean;
};

const SAFE_STUDENT_IMPORT_REASON_CODES = new Set([
  "invalid_row",
  "not_found",
  "ambiguous",
  "duplicate_in_file",
  "password_policy",
  "phone_in_use",
  "ps_number_in_use",
  "processing_error",
]);

function importResultRows(value: unknown): Array<{ row: number | null; name: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_STORED_RESULT_ROWS).flatMap((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string") return [];
    return [{
      row: typeof record.row === "number" && Number.isFinite(record.row) ? record.row : null,
      name: record.name.slice(0, 200),
    }];
  });
}

function safeImportFailureReason(record: Record<string, unknown>): string {
  if (
    typeof record.reason_code === "string"
    && SAFE_STUDENT_IMPORT_REASON_CODES.has(record.reason_code)
    && typeof record.error === "string"
    && record.error.trim()
  ) {
    return record.error.trim().slice(0, 300);
  }
  return "입력값을 확인한 뒤 다시 시도해 주세요.";
}

export function pollExcelJob(
  taskId: string,
  context: ExcelJobPollContext,
  onSuccess?: () => void,
  onProgress?: () => void
) {
  return api
    .get<{
      job_id: string;
      job_type: string;
      status: string;
      progress?: {
        step?: string;
        percent?: number;
        step_index?: number | null;
        step_total?: number | null;
        step_name?: string | null;
        step_name_display?: string | null;
        step_percent?: number | null;
      } | null;
      result?: Record<string, unknown>;
      error_message?: string | null;
    }>(`/jobs/${encodeURIComponent(taskId)}/progress/`, context.requestConfig)
    .then((res) => {
      if (!context.isCurrent()) return;
      const status = res.data?.status;

      // ✅ UNKNOWN 상태 처리 (Redis TTL 만료 등)
      if (status === "UNKNOWN") {
        asyncStatusStore.setTaskStatusMessage(taskId, "진행 상태를 다시 확인하고 있습니다. 같은 파일을 다시 등록하지 않아도 됩니다.");
        return;
      }
      asyncStatusStore.setTaskStatusMessage(taskId, undefined);

      const progress = res.data?.progress;
      const percent = progress?.percent;
      const stepIndex = progress?.step_index;
      const stepTotal = progress?.step_total;
      const stepName = progress?.step_name_display || progress?.step_name;
      const stepPercent = progress?.step_percent;

      // ✅ 단계 정보 구성 (단계 정보가 있으면 항상 전달)
      const encodingStep =
        typeof stepIndex === "number" &&
        typeof stepTotal === "number" &&
        typeof stepName === "string" &&
        typeof stepPercent === "number"
          ? { index: stepIndex, total: stepTotal, name: stepName, percent: stepPercent }
          : null;

      // ✅ RUNNING 상태에서 진행률 업데이트 (단계 정보가 있으면 항상 전달)
      if (status === "RUNNING") {
        onProgress?.();
        // percent가 없어도 단계 정보만 있으면 업데이트 (단계별 진행률 표시)
        const finalPercent = typeof percent === "number" ? percent : (encodingStep ? Math.round((encodingStep.index - 1) / encodingStep.total * 100 + (encodingStep.percent / encodingStep.total)) : undefined);
        if (finalPercent !== undefined || encodingStep) {
          asyncStatusStore.updateProgress(taskId, finalPercent ?? 0, undefined, encodingStep);
        } else {
          // ✅ RUNNING인데 아직 progress 미도착: 0%로 표시해 "대기 중" 대신 진행 중으로 표기 (video batch와 동일)
          asyncStatusStore.updateProgress(taskId, 0, undefined, null);
        }
      }

      // ✅ 완료/실패 상태 처리
      const errMsg = res.data?.error_message?.trim();
      const isFailed = status === "FAILED" ||
                       status === "REJECTED_BAD_INPUT" ||
                       status === "FALLBACK_TO_GPU" ||
                       status === "REVIEW_REQUIRED" ||
                       (status === "DONE" && errMsg);

      if (isFailed) {
        // A worker can fail after committing earlier rows. Refresh consumers
        // without implying that the full file succeeded or submitting it again.
        onSuccess?.();
        asyncStatusStore.completeTask(
          taskId,
          "error",
          errMsg || "처리 실패"
        );
      } else if (status === "DONE") {
        if (!res.data.result) {
          asyncStatusStore.setTaskStatusMessage(taskId, "처리 결과를 다시 불러오고 있습니다. 같은 파일을 다시 등록하지 않아도 됩니다.");
          return;
        }
        onSuccess?.();
        // 엑셀 등록 결과 상세 표시
        const result = res.data?.result as Record<string, unknown> | undefined;
        const isEnrollmentImport = result != null && (
          Object.prototype.hasOwnProperty.call(result, "enrolled_count")
          || Object.prototype.hasOwnProperty.call(result, "not_found_students_count")
          || Object.prototype.hasOwnProperty.call(result, "ambiguous_students_count")
        );
        if (isEnrollmentImport) {
          const enrolledCount = Number(result?.enrolled_count ?? 0);
          const notFoundCount = Number(result?.not_found_students_count ?? 0);
          const ambiguousCount = Number(result?.ambiguous_students_count ?? 0);
          const parts = [`등록 ${enrolledCount}명`];
          if (notFoundCount > 0) parts.push(`명부 없음 ${notFoundCount}명`);
          if (ambiguousCount > 0) parts.push(`명부 중복 ${ambiguousCount}명`);
          asyncStatusStore.setTaskLabel(taskId, `엑셀 수강등록 — ${parts.join(", ")}`);

          const excludedParts: string[] = [];
          if (notFoundCount > 0) excludedParts.push(`학생 명부 없음 ${notFoundCount}명`);
          if (ambiguousCount > 0) excludedParts.push(`동일 정보 중복 ${ambiguousCount}명`);
          const excludedDetail = excludedParts.length > 0
            ? `등록 제외: ${excludedParts.join(", ")}. 학생 등록 또는 명부 정리 후 다시 시도해 주세요.`
            : undefined;
          if (excludedDetail) {
            feedback.warning(`수강등록 결과: ${excludedDetail}`);
          }
          const excludedRows = Array.isArray(result.excluded_rows) ? result.excluded_rows : [];
          const excludedCount = Number(result.excluded_count ?? (notFoundCount + ambiguousCount));
          const priorAcknowledged = asyncStatusStore.getState().find((task) => task.id === taskId)
            ?.studentImportResult?.acknowledged === true;
          asyncStatusStore.setStudentImportResult(taskId, {
            kind: "enrollment",
            total: Number(result.total ?? (enrolledCount + excludedCount)),
            createdCount: enrolledCount,
            duplicateCount: 0,
            restoredCount: 0,
            failedCount: excludedCount,
            createdRows: importResultRows(result.enrolled_rows),
            duplicateRows: [],
            restoredRows: [],
            failedRows: excludedRows.slice(0, MAX_STORED_RESULT_ROWS).flatMap((item) => {
              if (item == null || typeof item !== "object" || Array.isArray(item)) return [];
              const row = item as Record<string, unknown>;
              return [{
                row: typeof row.row === "number" ? row.row : null,
                name: typeof row.name === "string" ? row.name : "(이름 없음)",
                reason: safeImportFailureReason(row),
              }];
            }),
            acknowledged: priorAcknowledged,
          });
          const allExcluded = excludedCount > 0 && enrolledCount === 0;
          asyncStatusStore.completeTask(taskId, allExcluded ? "error" : "success",
            allExcluded ? "수강 등록된 학생이 없습니다. 결과에서 제외 사유를 확인해 주세요." : excludedDetail);
          return;
        }
        const created = Number(result?.created ?? 0);
        const total = Number(result?.total ?? 0);
        const rawCreatedRows = Array.isArray(result?.created_rows) ? result.created_rows : [];
        const rawDuplicateRows = Array.isArray(result?.duplicates) ? result.duplicates : [];
        const rawRestoredRows = Array.isArray(result?.restored) ? result.restored : [];
        const rawFailedRows = Array.isArray(result?.failed) ? result.failed : [];
        const createdRows = importResultRows(rawCreatedRows);
        const duplicateRows = importResultRows(rawDuplicateRows);
        const restoredRows = importResultRows(rawRestoredRows);
        const duplicateCount = rawDuplicateRows.length;
        const restoredCount = rawRestoredRows.length;
        const failedCount = rawFailedRows.length;
        const failedRows = rawFailedRows
          .slice(0, MAX_STORED_RESULT_ROWS)
          .flatMap((item) => {
              if (item == null || typeof item !== "object" || Array.isArray(item)) return [];
              const row = item as Record<string, unknown>;
              return [{
                row: typeof row.row === "number" ? row.row : null,
                name: typeof row.name === "string" ? row.name : "(이름 없음)",
                reason: safeImportFailureReason(row),
              }];
            });
        if (result) {
          const parts: string[] = [];
          if (created > 0) parts.push(`신규 등록 ${created}명`);
          if (duplicateCount > 0) parts.push(`이미 등록된 학생 ${duplicateCount}명`);
          if (restoredCount > 0) parts.push(`복원 ${restoredCount}명`);
          if (failedCount > 0) parts.push(`실패 ${failedCount}명`);
          const summary = parts.length > 0 ? parts.join(", ") : "완료";
          asyncStatusStore.setTaskLabel(taskId, `학생 일괄 등록 — ${summary}`);
          const priorAcknowledged = asyncStatusStore
            .getState()
            .find((task) => task.id === taskId)
            ?.studentImportResult?.acknowledged === true;
          asyncStatusStore.setStudentImportResult(taskId, {
            total: Number.isFinite(total) && total >= 0 ? Math.floor(total) : 0,
            createdCount: Number.isFinite(created) && created >= 0 ? Math.floor(created) : 0,
            duplicateCount,
            restoredCount,
            failedCount,
            createdRows,
            duplicateRows,
            restoredRows,
            failedRows,
            acknowledged: priorAcknowledged,
          });
          if (restoredCount > 0) {
            feedback.success(`삭제 대기중인 학생 ${restoredCount}명이 모두 복원되었습니다.`);
          }
          if (duplicateCount > 0 || failedCount > 0) {
            const msgs: string[] = [];
            if (duplicateCount > 0) msgs.push(`이미 등록된 학생 ${duplicateCount}명`);
            if (failedCount > 0) msgs.push(`실패 ${failedCount}명`);
            feedback.warning(`학생 등록 결과: ${msgs.join(", ")}. 정상 행 처리는 완료되었습니다.`);
          }
          const credentials = Array.isArray(result.credentials)
            ? result.credentials.flatMap((item) => {
                if (item == null || typeof item !== "object" || Array.isArray(item)) return [];
                const record = item as Record<string, unknown>;
                if (
                  typeof record.name !== "string"
                  || typeof record.login_id !== "string"
                  || typeof record.password !== "string"
                ) {
                  return [];
                }
                return [{
                  name: record.name,
                  login_id: record.login_id,
                  password: record.password,
                }];
              })
            : [];
          if (credentials.length > 0) {
            asyncStatusStore.setStudentInitialPasswordDownload(taskId, credentials);
            const task = asyncStatusStore.getState().find((item) => item.id === taskId);
            if (!task?.meta?.suppressCredentialAutoDownload) {
              void import("@/shared/product/students/studentExcel")
                .then(({ downloadStudentInitialPasswordCredentials }) =>
                  downloadStudentInitialPasswordCredentials(credentials)
                )
                .then(() => {
                  feedback.success("학생별 초기 비밀번호 목록을 내려받았습니다.");
                })
                .catch(() => {
                  feedback.error("자동 다운로드에 실패했습니다. 작업박스의 ‘비밀번호 목록’ 버튼을 눌러 주세요.");
                });
            }
          }
        }
        const hasHandledRow = created + duplicateCount + restoredCount > 0;
        asyncStatusStore.completeTask(
          taskId,
          failedCount > 0 && !hasHandledRow ? "error" : "success",
          failedCount > 0 && !hasHandledRow
            ? "등록 가능한 학생이 없습니다. 결과에서 실패 사유를 확인해 주세요."
            : undefined,
        );
      }
    })
    .catch((error: unknown) => {
      if (!context.isCurrent()) return;
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status === 403 || status === 404) {
        asyncStatusStore.completeTask(taskId, "error", "작업을 찾을 수 없거나 조회 권한이 없습니다. 원본 화면에서 상태를 확인해 주세요.");
        return;
      }
      asyncStatusStore.setTaskStatusMessage(taskId, "진행 상태 연결이 지연되어 다시 확인하고 있습니다. 등록된 행은 유지됩니다.");
    });
}
