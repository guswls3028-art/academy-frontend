// PATH: src/features/lectures/components/LectureEnrollStudentModal.tsx
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
    <AdminModal open onClose={onClose} type="action" width={620}>
      <ModalHeader
        type="action"
        title="수강생 등록"
        description="등록 방식을 선택하세요."
      />

      <ModalBody>
        <div className="modal-scroll-body grid gap-6 w-full max-w-full box-border">
          <div>
            <div className="modal-section-label mb-3">등록 방식</div>
            <div className="grid grid-cols-2 gap-5">
              <SessionBlockView
                variant="n1"
                compact={false}
                selected={false}
                showCheck={false}
                title="차시 생성 후 업로드"
                desc="차시를 먼저 만든 뒤 수강생을 일괄 반영"
                onClick={handleSessionCreate}
                ariaPressed={false}
              />
              <SessionBlockView
                variant="supplement"
                compact={false}
                selected={false}
                showCheck={false}
                title="엑셀 업로드"
                desc="엑셀 파일로 수강생 목록 업로드"
                onClick={handleExcelUpload}
                ariaPressed={false}
              />
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
            ESC 로 닫기
          </span>
        }
        right={
          <Button intent="secondary" onClick={onClose}>
            취소
          </Button>
        }
      />
    </AdminModal>
  );
}
