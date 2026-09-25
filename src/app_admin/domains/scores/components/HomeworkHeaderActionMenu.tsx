import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Popover } from "antd";
import { ChevronDown } from "lucide-react";

import { ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { AdminModal, ModalBody, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { AssessmentEditGuardProvider } from "@/shared/ui/assessment/AssessmentEditGuard";
import { deleteHomework, HomeworkPolicyPanel } from "@admin/domains/homework/public/scoreHeaderActions";
import { sessionAssessmentQueryKeys } from "@admin/domains/sessions/public/assessmentQueries";
import { scoresQueryKeys } from "../api/queryKeys";
import styles from "./ExamHeaderActionMenu.module.css";

type Props = {
  homeworkId: number;
  homeworkTitle: string;
  sessionId: number;
  deleteLocked?: boolean;
};

export default function HomeworkHeaderActionMenu({ homeworkId, homeworkTitle, sessionId, deleteLocked = false }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const closeEdit = async () => {
    if (saving) return;
    if (dirty && !await confirm({
      title: "과제 수정 닫기",
      message: "저장하지 않은 과제 설정이 있습니다. 입력은 이 브라우저에 임시 보관되며, 나중에 이어서 편집할 수 있습니다. 닫을까요?",
      confirmText: "닫기",
      danger: true,
    })) return;
    setEditOpen(false);
    setDirty(false);
  };

  const handleDelete = async () => {
    if (deleting || deleteLocked) return;
    setMenuOpen(false);
    const approved = await confirm({
      title: "과제 삭제",
      message: `‘${homeworkTitle}’ 과제를 이 차시에서 삭제할까요? 배정과 성적표 표시가 정리되며 기존 제출·점수 기록은 보존됩니다.`,
      confirmText: "삭제",
      danger: true,
    });
    if (!approved) return;
    setDeleting(true);
    try {
      await deleteHomework(homeworkId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.homeworks(sessionId) }),
        qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) }),
      ]);
      feedback.success("과제를 차시에서 삭제했습니다.");
    } catch (error) {
      feedback.error(extractApiError(error, "과제를 삭제하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = useCallback(() => { setEditOpen(false); setDirty(false); }, []);

  const menu = (
    <div className={styles.menu} role="menu" aria-label={`${homeworkTitle} 작업 선택`} onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
      <div className={styles.menuHeader}>
        <span>과제 작업</span>
        <div className={styles.menuHeaderActions}>
          <button type="button" role="menuitem" className={styles.headerAction} onClick={() => { setMenuOpen(false); setEditOpen(true); }}>수정</button>
          <button type="button" role="menuitem" className={`${styles.headerAction} ${styles.headerActionDanger}`} disabled={deleting || deleteLocked} title={deleteLocked ? "진행 중인 점수 입력을 저장한 뒤 삭제할 수 있습니다." : undefined} onClick={() => { void handleDelete(); }}>{deleting ? "삭제 중…" : "삭제"}</button>
        </div>
      </div>
      <p className={styles.menuDescription}>과제명과 운영 기준을 수정하거나 이 차시에서 삭제합니다.</p>
    </div>
  );

  return (
    <>
      <Popover content={menu} trigger="click" placement="bottom" open={menuOpen} onOpenChange={setMenuOpen} arrow={false} overlayClassName={styles.popover}>
        <button type="button" className="scores-table-exam-link" draggable={false} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`${homeworkTitle} 작업 선택`} title={`${homeworkTitle} — 작업 선택`} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onDragStart={(event) => { event.preventDefault(); event.stopPropagation(); }}>
          <span className="scores-table-head-title whitespace-normal break-keep min-w-0 leading-tight">{homeworkTitle}</span>
          <ChevronDown className="scores-table-exam-link__icon" size={ICON_FOR_BUTTON.sm} aria-hidden />
        </button>
      </Popover>
      <AdminModal open={editOpen} onClose={() => { void closeEdit(); }} closeDisabled={saving} type="action" width={MODAL_WIDTH.wide}>
        <ModalHeader type="action" title="과제 수정" subtitle={homeworkTitle} />
        <ModalBody>
          <div className="max-h-[min(70vh,680px)] overflow-y-auto pr-1">
            {editOpen && (
              <AssessmentEditGuardProvider>
                <HomeworkPolicyPanel homeworkId={homeworkId} onDirtyChange={setDirty} onSavingChange={setSaving} onSaved={handleSaved} />
              </AssessmentEditGuardProvider>
            )}
          </div>
        </ModalBody>
      </AdminModal>
    </>
  );
}
