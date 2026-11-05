import { lazy, Suspense, useCallback, useState } from "react";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { AssessmentEditGuardProvider } from "@/shared/ui/assessment/AssessmentEditGuard";
import ShowcasePublishModal from "./ShowcasePublishModal";

const ExamPolicyPanel = lazy(() => import("@admin/domains/exams/public/ExamPolicyPanel"));

type Props = {
  examId: number;
  examTitle: string;
  sessionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Score headers use the same complete policy editor as the exam workspace. */
export default function ExamHeaderQuickEdit({ examId, examTitle, sessionId, open, onOpenChange }: Props) {
  const confirm = useConfirm();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveAllowed, setSaveAllowed] = useState(false);
  const formId = `exam-policy-editor-${examId}`;
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const close = async () => {
    if (saving) return false;
    if (dirty && !await confirm({
      title: "시험 수정 닫기",
      message: "저장하지 않은 설정은 이 브라우저에 임시 보관됩니다. 닫을까요?",
      confirmText: "닫기",
      cancelText: "계속 편집",
    })) return false;
    onOpenChange(false);
    setDirty(false);
    setSaveAllowed(false);
    return true;
  };
  const handleSaved = useCallback(() => {
    setDirty(false);
    setSaving(false);
    setSaveAllowed(false);
    onOpenChange(false);
  }, [onOpenChange]);

  return <>
    <AdminModal open={open} onClose={() => { void close(); }} closeDisabled={saving} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader type="action" title="시험 설정" subtitle={examTitle} />
      <ModalBody>
        {open && <Suspense fallback={<p role="status">시험 설정을 불러오는 중…</p>}><AssessmentEditGuardProvider>
          <ExamPolicyPanel examId={examId} sessionId={sessionId} editing formId={formId} onSaveAllowedChange={setSaveAllowed} onDirtyChange={setDirty} onSavingChange={setSaving} onSaved={handleSaved} />
        </AssessmentEditGuardProvider></Suspense>}
      </ModalBody>
      <ModalFooter right={<><Button intent="secondary" onClick={() => { void close(); }} disabled={saving}>닫기</Button><Button intent="primary" type="submit" form={formId} disabled={!saveAllowed || saving} loading={saving}>저장</Button></>}
        left={<Button intent="ghost" size="sm" disabled={saving} data-testid={`showcase-publish-trigger-${examId}`} onClick={() => { void close().then((closed) => { if (closed) setShowcaseOpen(true); }); }}>성적 통계 게시</Button>} />
    </AdminModal>
    <ShowcasePublishModal open={showcaseOpen} onClose={() => setShowcaseOpen(false)} examId={examId} examTitle={examTitle} />
  </>;
}
