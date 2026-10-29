// PATH: src/app_admin/domains/lectures/components/LectureEnrollExcelModal.tsx
// 엑셀 업로드: docs/EXCEL-WORKFLOWS.md — studentExcel + ExcelUploadZone
// 기존 활성 학생만 매칭해 수강등록 + 1차시 생성 + 차시 등록·출결. 강의명 확인 후 진행.

import { useEffect, useRef, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import ExcelRowIssues from "@/shared/ui/excel/ExcelRowIssues";
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
  const readVersionRef = useRef(0);
  const submitLockRef = useRef(false);
  useEffect(() => {
    readVersionRef.current += 1;
    if (open) {
      setBusy(submitLockRef.current);
      setParsed(null);
      setSelectedFile(null);
    }
    return () => { readVersionRef.current += 1; };
  }, [open, lectureId]);

  const handleClose = () => {
    if (submitLockRef.current) return;
    readVersionRef.current += 1;
    onClose();
  };

  const handleExcelFileSelect = async (file: File) => {
    if (busy || submitLockRef.current) return;
    const readVersion = ++readVersionRef.current;
    setBusy(true);
    setParsed(null);
    setSelectedFile(null);
    try {
      const result = await parseStudentExcel(file, false); // Existing-student matching does not write profile fields.
      if (readVersion !== readVersionRef.current) return;
      if (!result.rows.length && !result.issues?.length) {
        feedback.error("등록할 학생 데이터가 없습니다.");
        return;
      }
      setSelectedFile(file);
      setParsed(result);
    } catch (e: unknown) {
      if (readVersion !== readVersionRef.current) return;
      const msg = e instanceof Error ? e.message : "엑셀 파일을 읽는 중 오류가 발생했습니다.";
      feedback.error(msg);
    } finally {
      if (readVersion === readVersionRef.current) setBusy(false);
    }
  };

  const handleConfirmAndRegister = async () => {
    if (busy || submitLockRef.current || !selectedFile || !parsed?.rows.length) return;
    submitLockRef.current = true;
    setBusy(true);
    try {
      const { job_id } = await lectureEnrollFromExcelUpload(lectureId, selectedFile);
      if (!job_id) {
        feedback.error("작업 ID를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      asyncStatusStore.addWorkerJob("엑셀 수강등록", job_id, "excel_parsing", lectureId);
      feedback.success("작업이 백그라운드에서 진행됩니다. 우상단 작업박스에서 확인할 수 있습니다.");
      onSuccess?.();
      onClose();
      setParsed(null);
      setSelectedFile(null);
    } catch (e: unknown) {
      feedback.error(e instanceof Error ? e.message : "등록 요청 중 오류가 발생했습니다.");
    } finally {
      submitLockRef.current = false;
      setBusy(false);
    }
  };

  if (!open) return null;

  const isConfirmStep = parsed != null;

  return (
    <AdminModal open onClose={handleClose} type="action" width={520} onEnterConfirm={isConfirmStep && !busy && parsed.rows.length > 0 ? handleConfirmAndRegister : undefined}>
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
              {busy && <p role="status">엑셀 파일을 읽고 있습니다…</p>}
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`modal-section-label ${styles.plannedCount}`}>
                  {parsed.rows.length}명 매칭 요청 예정
                </span>
                <Button
                  intent="ghost"
                  size="sm"
                  onClick={() => { setParsed(null); setSelectedFile(null); }}
                  disabled={busy}
                >
                  엑셀 다시 선택
                </Button>
              </div>
              {Boolean(parsed.issues?.length) && (
                <div className="space-y-2 break-words" role="alert">
                  <strong>입력 확인 필요 {parsed.issues!.length}명</strong>
                  <p>아래 행은 등록되지 않습니다. 파일을 수정해 다시 선택하거나 정상 {parsed.rows.length}명만 먼저 요청할 수 있습니다.</p>
                  <ExcelRowIssues issues={parsed.issues!} />
                </div>
              )}
            </>
          )}
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span className={`modal-hint ${styles.footerHint}`}>
            {isConfirmStep
              ? "입력을 확인한 뒤 등록해 주세요. 접수 후에는 작업박스에서 진행 상태와 결과를 확인할 수 있습니다."
              : "엑셀 파일 선택 후 강의명 확인 단계로 이동합니다."}
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={handleClose} disabled={busy}>
              취소
            </Button>
            {isConfirmStep ? (
              <Button
                intent="primary"
                onClick={handleConfirmAndRegister}
                disabled={busy || parsed.rows.length === 0}
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
