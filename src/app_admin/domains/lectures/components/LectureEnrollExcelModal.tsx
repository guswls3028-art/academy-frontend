// PATH: src/app_admin/domains/lectures/components/LectureEnrollExcelModal.tsx
// 엑셀 업로드 SSOT: docs/DESIGN_SSOT.md §8 — studentExcel + ExcelUploadZone
// 기존 활성 학생만 매칭해 수강등록 + 1차시 생성 + 차시 등록·출결. 강의명 확인 후 진행.

import { useEffect, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import {
  parseStudentExcel,
  downloadStudentExcelTemplate,
  type ParseStudentExcelResult,
} from "@/shared/product/students/studentExcel";
import { lectureEnrollFromExcelUpload } from "../api/enrollments";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import styles from "./LectureEnrollExcelModal.module.css";

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
  const slm = useSchoolLevelMode();
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParseStudentExcelResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  useEffect(() => {
    if (open) {
      setParsed(null);
      setSelectedFile(null);
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
    setBusy(true);
    try {
      const { job_id } = await lectureEnrollFromExcelUpload(lectureId, selectedFile);
      if (!job_id) {
        feedback.error("작업 ID를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      asyncStatusStore.addWorkerJob("엑셀 수강등록", job_id, "excel_parsing");
      feedback.success("작업이 백그라운드에서 진행됩니다. 우상단 작업박스에서 확인할 수 있습니다.");
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
    <AdminModal open onClose={onClose} type="action" width={520} onEnterConfirm={isConfirmStep && !busy ? handleConfirmAndRegister : undefined}>
      <ModalHeader
        type="action"
        title="수강생 엑셀 업로드"
        description={
          isConfirmStep
            ? "강의가 맞는지 확인한 뒤 등록해 주세요."
            : "학생 명부에 이미 등록된 학생만 엑셀로 일괄 수강 등록합니다."
        }
      />

      <ModalBody>
        <div
          className={`modal-scroll-body modal-scroll-body--compact ${styles.body}`}
        >
          {!isConfirmStep ? (
            <>
              <div className={`modal-form-row modal-form-row--1-auto ${styles.downloadRow}`}>
                <div />
                <Button
                  intent="secondary"
                  onClick={() => {
                    void downloadStudentExcelTemplate(slm.mode).catch(() => feedback.error("엑셀 양식 다운로드에 실패했습니다."));
                  }}
                  disabled={busy}
                >
                  엑셀 양식 다운로드
                </Button>
              </div>
              <ExcelUploadZone onFileSelect={handleExcelFileSelect} disabled={busy} />
            </>
          ) : (
            <>
              <div className={`modal-form-group ${styles.compactGroup}`}>
                <div className={`modal-section-label ${styles.sectionLabelCompact}`}>
                  강의 일치 확인
                </div>
                <div className={`rounded-md p-3 text-sm ${styles.confirmPanel}`}>
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
                  <p className={`mt-2 text-[13px] ${styles.confirmHint}`}>
                    학생 명부에 이미 등록된 활성 학생만 이름·학부모 전화번호로 매칭합니다. 명부에 없는 학생은 새로 만들지 않습니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className={`modal-section-label ${styles.plannedCount}`}>
                  {parsed.rows.length}명 매칭 요청 예정
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
          <span className={`modal-hint ${styles.footerHint}`}>
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
                disabled={busy}
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
