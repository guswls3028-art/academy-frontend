// PATH: src/features/lectures/components/LectureSettingsModal.tsx
// 강의 설정 모달 — 차시 추가 모달과 동일한 블록형 디자인 (SessionBlockView)
// 활성 강의: 강의수정, 강의종료 | 지난 강의: 강의복원, 강의삭제

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { SessionBlockView } from "@/shared/ui/session-block";
import { updateLecture, deleteLecture } from "../api/sessions";

type LectureItem = {
  id: number;
  title: string;
  is_active?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  lecture: LectureItem;
  /** true = 지난 강의 탭 (강의복원, 강의삭제) */
  isPast: boolean;
  /** 강의 수정 클릭 시 (강의 상세로 이동 등) */
  onEdit?: (lectureId: number) => void;
  onAfterEnd?: () => void;
  onAfterRestore?: () => void;
  onAfterDelete?: () => void;
};

export default function LectureSettingsModal({
  open,
  onClose,
  lecture,
  isPast,
  onEdit,
  onAfterEnd,
  onAfterRestore,
  onAfterDelete,
}: Props) {
  if (!open) return null;

  async function handleEnd() {
    try {
      await updateLecture(lecture.id, { is_active: false });
      onAfterEnd?.();
      onClose();
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "강의 종료에 실패했습니다.");
    }
  }

  async function handleRestore() {
    try {
      await updateLecture(lecture.id, { is_active: true });
      onAfterRestore?.();
      onClose();
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "강의 복원에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!confirm(`"${lecture.title}" 강의를 완전히 삭제하시겠습니까? 차시·수강생·출결 등 모든 관련 정보가 제거됩니다.`)) return;
    try {
      await deleteLecture(lecture.id);
      onAfterDelete?.();
      onClose();
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "강의 삭제에 실패했습니다.");
    }
  }

  return (
    <AdminModal open onClose={onClose} type="action" width={620}>
      <ModalHeader type="action" title="강의 설정" />

      <ModalBody>
        <div className="modal-scroll-body grid gap-6 w-full max-w-full box-border">
          <div>
            <div className="modal-section-label mb-3">선택</div>
            <div className="grid grid-cols-2 gap-5">
              {isPast ? (
                <>
                  <SessionBlockView
                    variant="n1"
                    compact={false}
                    selected={false}
                    showCheck={false}
                    title="강의 복원"
                    desc="지난 강의를 다시 강의목록으로 이동"
                    onClick={handleRestore}
                    ariaPressed={false}
                  />
                  <SessionBlockView
                    variant="supplement"
                    compact={false}
                    selected={false}
                    showCheck={false}
                    title="강의 삭제"
                    desc="강의 및 모든 관련 정보 완전 제거"
                    onClick={handleDelete}
                    ariaPressed={false}
                  />
                </>
              ) : (
                <>
                  <SessionBlockView
                    variant="n1"
                    compact={false}
                    selected={false}
                    showCheck={false}
                    title="강의 수정"
                    desc="강의 정보 수정"
                    onClick={() => {
                      onClose();
                      onEdit ? onEdit(lecture.id) : window.location.assign(`/admin/lectures/${lecture.id}`);
                    }}
                    ariaPressed={false}
                  />
                  <SessionBlockView
                    variant="supplement"
                    compact={false}
                    selected={false}
                    showCheck={false}
                    title="강의 종료"
                    desc="지난 강의 탭으로 이동"
                    onClick={handleEnd}
                    ariaPressed={false}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <Button intent="secondary" onClick={onClose}>
            닫기
          </Button>
        }
      />
    </AdminModal>
  );
}
