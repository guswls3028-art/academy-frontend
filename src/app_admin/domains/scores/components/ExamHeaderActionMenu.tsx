import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Popover } from "antd";
import {
  ChevronDown,
  ClipboardCheck,
  ScanLine,
  Settings2,
} from "lucide-react";

import { ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { deleteSessionExam } from "@admin/domains/exams/public/sessionExamActions";
import { invalidateSessionExamQueries } from "@admin/domains/sessions/public/assessmentQueries";
import ExamHeaderQuickEdit from "./ExamHeaderQuickEdit";
import styles from "./ExamHeaderActionMenu.module.css";

export type ExamHeaderAction = "manual" | "omr";

type Props = {
  examId: number;
  examTitle: string;
  gradingMode: "choice" | "written" | "mixed";
  manualGradingMethod: "correctness" | "score";
  initialMaxScore: number | null;
  initialPassScore: number | null;
  sessionId: number;
  onSelect: (action: ExamHeaderAction) => void;
  deleteLocked?: boolean;
};

type MenuActionProps = {
  title: string;
  description: string;
  icon: ReactNode;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

const GRADING_MODE_LABEL = {
  choice: "OMR 자동채점",
  written: "직접 채점",
  mixed: "OMR + 직접 채점",
} as const;

function MenuAction({
  title,
  description,
  icon,
  accent = false,
  disabled = false,
  onClick,
}: MenuActionProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`${styles.menuAction} ${accent ? styles.menuActionAccent : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.menuActionIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.menuActionCopy}>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
    </button>
  );
}

export default function ExamHeaderActionMenu({
  examId,
  examTitle,
  gradingMode,
  manualGradingMethod,
  initialMaxScore,
  initialPassScore,
  sessionId,
  onSelect,
  deleteLocked = false,
}: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canOpenManualGrading = gradingMode !== "choice";
  const canOpenOmr = gradingMode !== "written";
  const manualActionTitle =
    canOpenManualGrading && manualGradingMethod === "score"
      ? "문항별 점수 입력"
      : "정오표 작성";

  const selectAction = (action: ExamHeaderAction) => {
    setMenuOpen(false);
    onSelect(action);
  };

  const handleDelete = async () => {
    if (deleting || deleteLocked) return;
    setMenuOpen(false);
    const approved = await confirm({
      title: "시험 삭제",
      message: `‘${examTitle}’ 시험을 이 차시에서 삭제할까요? 배정과 성적표 표시가 정리됩니다. 제출·채점 기록이 있으면 서버 정책에 따라 보존됩니다.`,
      confirmText: "삭제",
      danger: true,
    });
    if (!approved) return;
    setDeleting(true);
    try {
      await deleteSessionExam(examId, sessionId);
      await invalidateSessionExamQueries(qc, { sessionId, examId });
      feedback.success("시험을 차시에서 삭제했습니다.");
    } catch (error) {
      feedback.error(extractApiError(error, "시험을 삭제하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      setDeleting(false);
    }
  };

  const menu = (
    <div
      className={styles.menu}
      role="menu"
      aria-label={`${examTitle} 작업 선택`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className={styles.menuHeader}>
        <span>시험 작업</span>
        <div className={styles.menuHeaderActions}>
          <button type="button" role="menuitem" className={styles.headerAction} onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}>수정</button>
          <button type="button" role="menuitem" className={`${styles.headerAction} ${styles.headerActionDanger}`} disabled={deleting || deleteLocked} title={deleteLocked ? "진행 중인 점수 입력을 저장한 뒤 삭제할 수 있습니다." : undefined} onClick={() => { void handleDelete(); }}>{deleting ? "삭제 중…" : "삭제"}</button>
        </div>
      </div>
      <span className={styles.menuMode}>{GRADING_MODE_LABEL[gradingMode]}</span>
      <MenuAction
        title={manualActionTitle}
        description={
          canOpenManualGrading
            ? manualGradingMethod === "correctness"
              ? "학생별 O/X/오답노트를 입력하고 성적 확정"
              : "학생별 문항 점수를 입력하고 성적 확정"
            : "시험 설정에서 정오표 직접입력으로 변경"
        }
        icon={<ClipboardCheck size={ICON_FOR_BUTTON.md} />}
        accent
        disabled={!canOpenManualGrading}
        onClick={() => selectAction("manual")}
      />
      <MenuAction
        title="OMR 검토"
        description={
          canOpenOmr
            ? "답안 인식 결과와 학생 연결을 확인"
            : "OMR 문항이 있는 시험에서 사용"
        }
        icon={<ScanLine size={ICON_FOR_BUTTON.md} />}
        disabled={!canOpenOmr}
        onClick={() => selectAction("omr")}
      />
      <div className={styles.menuDivider} />
      <MenuAction
        title="시험 설정"
        description="채점 방식 · 시험명 · 만점 · 커트라인 관리"
        icon={<Settings2 size={ICON_FOR_BUTTON.md} />}
        onClick={() => {
          setMenuOpen(false);
          setSettingsOpen(true);
        }}
      />
    </div>
  );

  return (
    <>
      <Popover
        content={menu}
        trigger="click"
        placement="bottom"
        open={menuOpen}
        onOpenChange={setMenuOpen}
        arrow={false}
        overlayClassName={styles.popover}
      >
        <button
          type="button"
          className="scores-table-exam-link"
          draggable={false}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`${examTitle} 작업 선택`}
          title={`${examTitle} — 작업 선택`}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <span className="scores-table-head-title whitespace-normal break-keep min-w-0 leading-tight">
            {examTitle}
          </span>
          <ChevronDown
            className="scores-table-exam-link__icon"
            size={ICON_FOR_BUTTON.sm}
            aria-hidden
          />
        </button>
      </Popover>

      <ExamHeaderQuickEdit
        examId={examId}
        examTitle={examTitle}
        initialGradingMode={gradingMode}
        initialManualGradingMethod={manualGradingMethod}
        initialMaxScore={initialMaxScore}
        initialPassScore={initialPassScore}
        sessionId={sessionId}
        open={settingsOpen}
        hideTrigger
        onOpenChange={setSettingsOpen}
      />
    </>
  );
}
