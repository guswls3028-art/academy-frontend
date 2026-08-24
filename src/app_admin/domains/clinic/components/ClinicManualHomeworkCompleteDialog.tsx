import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";

import type { ClinicTarget } from "../api/clinicTargets";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";

type Props = {
  target: ClinicTarget | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (memo: string) => void;
  mode?: "homework-complete" | "exam-waive";
};

export default function ClinicManualHomeworkCompleteDialog({
  target,
  pending,
  onClose,
  onConfirm,
  mode = "homework-complete",
}: Props) {
  const [memo, setMemo] = useState("");
  const targetKey = `${target?.session_id ?? ""}:${target?.enrollment_id ?? ""}:${target?.source_id ?? ""}`;

  useEffect(() => {
    setMemo("");
  }, [targetKey]);

  const normalizedMemo = memo.trim();
  const isExamWaive = mode === "exam-waive";

  return (
    <AdminModal
      open={target != null}
      onClose={() => {
        if (!pending) onClose();
      }}
      type="confirm"
      width={480}
      noMinimize
      closeDisabled={pending}
    >
      <ModalHeader
        type="confirm"
        title={isExamWaive ? "시험 미응시 면제" : "과제 제출 확인·완료"}
        description={isExamWaive
          ? "결석 등 정당한 미응시 사유를 남긴 뒤 면제합니다. 점수 합격이나 일반 통과로 바꾸지 않습니다."
          : "문자·사진·종이 등 사이트 밖으로 제출한 과제를 선생님이 확인했을 때만 완료합니다. 사유와 완료 결과는 저장 후 목록에서 다시 확인합니다."}
      />
      <ModalBody>
        <div className="clinic-hub__waive-form">
          <div className="clinic-hub__waive-target">
            <BookOpen size={18} aria-hidden />
            <div>
              <strong>{target?.student_name}</strong>
              <span>{target?.source_title || target?.session_title || (isExamWaive ? "미응시 시험" : "미제출 과제")}</span>
            </div>
          </div>
          <label className="clinic-hub__waive-field">
            <span>확인 사유 <em>필수</em></span>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              maxLength={500}
              rows={4}
              autoFocus
              placeholder={isExamWaive ? "예: 이전 수업 결석으로 면제" : "예: 문자 제출 확인, 현장 종이 과제 확인"}
              disabled={pending}
            />
            <small>{normalizedMemo.length}/500 · 최소 2자</small>
          </label>
        </div>
      </ModalBody>
      <ModalFooter
        right={(
          <>
            <Button intent="secondary" onClick={onClose} disabled={pending}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={() => onConfirm(normalizedMemo)}
              disabled={pending || normalizedMemo.length < 2}
              loading={pending}
            >
              {isExamWaive ? "사유 남기고 면제" : "제출 확인하고 완료"}
            </Button>
          </>
        )}
      />
    </AdminModal>
  );
}
