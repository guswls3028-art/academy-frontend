// PATH: src/features/lectures/components/LectureEnrollExcelModal.tsx
// 엑셀 업로드 SSOT: docs/DESIGN_SSOT.md §8 — studentExcel + ExcelUploadZone
// 원테이크: 학생 없으면 생성 + 수강등록 + 1차시 생성 + 차시 등록·출결. 강의명 확인 후 진행.

import { useEffect, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import {
  parseStudentExcel,
  downloadStudentExcelTemplate,
  type ParseStudentExcelResult,
} from "@/features/students/excel/studentExcel";
import { lectureEnrollFromExcelUpload } from "../api/enrollments";
import { feedback } from "@/shared/ui/feedback/feedback";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";

interface Props {
  lectureId: number;
  /** 현재 선택한 강의명 (엑셀 강의명과 비교 확인용) */
  lectureTitle: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LectureEnrollExcelModal({
  lectureId,
  lectureTitle,
  open,
  onClose,
  onSuccess,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParseStudentExcelResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [initialPassword, setInitialPassword] = useState("");

  useEffect(() => {
    if (open) {
      setParsed(null);
      setSelectedFile(null);
      setInitialPassword("");
    }
  }, [open]);

  const handleExcelFileSelect = async (file: File) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await parseStudentExcel(file);
      if (!result.rows.length) {
        feedback.error("등록할 학생 데이터가 없습니다.");
        return;
      }
      setSelectedFile(file);
      setParsed(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "엑셀 파일을 읽는 중 오류가 발생했습니다.";
      feedback.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAndRegister = async () => {
    if (busy || !selectedFile || !parsed?.rows.length) return;
    const pwd = initialPassword.trim();
    if (pwd.length < 4) {
      feedback.error("초기 비밀번호는 4자 이상이어야 합니다. (신규 생성 학생 로그인용)");
      return;
    }
    setBusy(true);
    try {
      const { job_id } = await lectureEnrollFromExcelUpload(lectureId, selectedFile, pwd);
      if (!job_id) {
        feedback.error("작업 ID를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      asyncStatusStore.addWorkerJob("엑셀 수강등록", job_id, "excel_parsing");
      feedback.success("작업이 백그라운드에서 진행됩니다. 우하단에서 진행 상황을 확인할 수 있습니다.");
      onSuccess?.();
      onClose();
      setParsed(null);
      setSelectedFile(null);
    } catch (e: unknown) {
      feedback.error(e instanceof Error ? e.message : "등록 요청 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const isConfirmStep = parsed != null && parsed.rows.length > 0;

  return (
    <AdminModal open onClose={onClose} type="action" width={520}>
      <ModalHeader
        type="action"
        title="수강생 엑셀 업로드"
        description={
          isConfirmStep
            ? "강의가 맞는지 확인한 뒤 등록해 주세요."
            : "엑셀 파일로 수강생을 일괄 등록합니다. (학생 없으면 자동 생성 + 1차시 등록)"
        }
      />

      <ModalBody>
        <div
          className="modal-scroll-body modal-scroll-body--compact"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {!isConfirmStep ? (
            <>
              <div className="modal-form-row modal-form-row--1-auto" style={{ alignItems: "end" }}>
                <div />
                <Button intent="secondary" onClick={downloadStudentExcelTemplate} disabled={busy}>
                  엑셀 양식 다운로드
                </Button>
              </div>
              <ExcelUploadZone onFileSelect={handleExcelFileSelect} disabled={busy} />
            </>
          ) : (
            <>
              <div className="modal-form-group" style={{ marginBottom: 0 }}>
                <div className="modal-section-label" style={{ marginBottom: 6 }}>
                  강의 일치 확인
                </div>
                <div
                  className="rounded-md p-3 text-sm"
                  style={{
                    background: "var(--color-surface-subtle)",
                    border: "1px solid var(--color-border-divider)",
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <div>
                      <span className="text-[var(--color-text-muted)]">엑셀에 적힌 강의명: </span>
                      <strong>{parsed.lectureNameFromExcel?.trim() || "— 없음 —"}</strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)]">현재 강의(선택한 강의): </span>
                      <strong>{lectureTitle || "—"}</strong>
                    </div>
                  </div>
                  <p className="mt-2 text-[13px]" style={{ color: "var(--color-text-muted)" }}>
                    다른 강의 엑셀을 올리지 않았는지 확인한 뒤, 맞으면 아래에서 초기 비밀번호를 입력하고 등록해 주세요.
                  </p>
                </div>
              </div>

              <div className="modal-form-group" style={{ marginBottom: 0 }}>
                <label className="modal-section-label" style={{ marginBottom: 6 }}>
                  초기 비밀번호 <span style={{ color: "var(--color-error)" }}>*</span>
                </label>
                <input
                  type="password"
                  className="ds-input"
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="신규 생성 학생 로그인용 (4자 이상)"
                  disabled={busy}
                  autoComplete="new-password"
                  style={{ maxWidth: 280 }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="modal-section-label" style={{ marginBottom: 0 }}>
                  {parsed.rows.length}명 등록 예정
                </span>
                <Button
                  intent="ghost"
                  size="sm"
                  onClick={() => setParsed(null)}
                  disabled={busy}
                >
                  엑셀 다시 선택
                </Button>
              </div>
            </>
          )}
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span className="modal-hint" style={{ marginBottom: 0 }}>
            {isConfirmStep
              ? "맞으면 등록하기를 누르세요. 업로드 후 창을 닫아도 백그라운드에서 작업이 진행됩니다. 우하단에서 진행률을 확인할 수 있습니다."
              : "엑셀 파일 선택 후 강의명 확인 단계로 이동합니다."}
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            {isConfirmStep ? (
              <Button
                intent="primary"
                onClick={handleConfirmAndRegister}
                disabled={busy || initialPassword.trim().length < 4}
              >
                {busy ? "업로드 중…" : "맞아요, 등록하기"}
              </Button>
            ) : null}
          </>
        }
      />
    </AdminModal>
  );
}
