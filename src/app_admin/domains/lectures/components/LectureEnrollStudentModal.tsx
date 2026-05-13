// PATH: src/app_admin/domains/lectures/components/LectureEnrollStudentModal.tsx
// Design: docs/DESIGN_SSOT.md (차시 추가 모달 초기 화면 패턴)

import {
  AdminModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";

interface Props {
  lectureId: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** 차시 생성 후 업로드 선택 시: 이 모달 닫고 차시 추가 모달 열기 */
  onChooseSessionCreate?: () => void;
  /** 엑셀 업로드 선택 시: 이 모달 닫고 엑셀 업로드 모달 열기 */
  onChooseExcelUpload?: () => void;
}

export default function LectureEnrollStudentModal({
  open,
  onClose,
  onChooseSessionCreate,
  onChooseExcelUpload,
}: Props) {
  const handleSessionCreate = () => {
    onClose();
    onChooseSessionCreate?.();
  };

  const handleExcelUpload = () => {
    onClose();
    onChooseExcelUpload?.();
  };

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={560}>
      <ModalHeader
        type="action"
        title="수강생 등록"
        description="어떻게 등록할까요?"
      />

      <ModalBody>
        <div className="modal-scroll-body grid gap-3 w-full max-w-full box-border">
          {/* 1. 엑셀 일괄 — 학원장이 명단을 가지고 있을 때 가장 빠른 경로 */}
          <SessionBlockView
            variant="supplement"
            compact={false}
            selected={false}
            showCheck={false}
            title="엑셀로 일괄 등록 (추천)"
            desc="이름·전화·학교·학년이 적힌 엑셀 파일로 한 번에 등록합니다. 명단에 없는 학생은 자동 생성."
            onClick={handleExcelUpload}
            ariaPressed={false}
          />
          {/* 2. 차시별 등록 — 강의에 차시가 있어야 함. 차시별 출결 대상 등록 흐름. */}
          <SessionBlockView
            variant="n1"
            compact={false}
            selected={false}
            showCheck={false}
            title="차시 만들고 하나씩 등록"
            desc="차시(1주차/2주차…)를 만든 뒤 각 차시에서 직접 학생을 선택합니다. 직전 차시 수강생 한 번에 불러오기 지원."
            onClick={handleSessionCreate}
            ariaPressed={false}
          />
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <Button intent="secondary" onClick={onClose}>
            취소
          </Button>
        }
      />
    </AdminModal>
  );
}
