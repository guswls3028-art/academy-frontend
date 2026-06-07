/**
 * 학생앱 사용 가이드 — 업무 흐름 중심 워크플로우 + 아코디언 + 투어
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGuideTour } from "@/shared/ui/guide";
import type { GuideWorkflow } from "@/shared/ui/guide";
import { STUDENT_WORKFLOWS } from "../data/studentWorkflows";
import styles from "./GuidePage.module.css";

/* ================================================================
   워크플로우 카드 (아코디언)
   ================================================================ */
function WorkflowCard({
  wf,
  open,
  onToggle,
}: {
  wf: GuideWorkflow;
  open: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const { startTour } = useGuideTour();
  const disclosureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = disclosureRef.current;
    if (!node) return;

    if (open) {
      node.inert = false;
      node.removeAttribute("inert");
      return;
    }

    if (
      document.activeElement instanceof HTMLElement &&
      node.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }
    node.inert = true;
    node.setAttribute("inert", "");
  }, [open]);

  const handleTour = useCallback(() => {
    if (!wf.tourPath || !wf.tourSteps?.length) return;
    startTour({ steps: wf.tourSteps });
    navigate(wf.tourPath);
  }, [wf, startTour, navigate]);

  return (
    <div className={styles.card} data-open={open}>
      {/* 헤더 */}
      <button
        type="button"
        onClick={onToggle}
        className={styles.headerButton}
        aria-expanded={open}
      >
        <div className={styles.iconWrap}>
          {wf.icon}
        </div>
        <div className={styles.headerText}>
          <div className={styles.workflowTitle}>{wf.title}</div>
          <div className={styles.summary}>
            {wf.summary}
          </div>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--stu-text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.chevron}
          data-open={open}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 아코디언 본문 */}
      <div
        ref={disclosureRef}
        className={styles.disclosure}
        data-open={open}
        aria-hidden={!open}
      >
        <div className={styles.bodyClip}>
          <div className={styles.body}>
            {/* 단계 목록 */}
            <div className={styles.steps}>
              {wf.steps.map((step, i) => (
                <div
                  key={`${step.title}-${i}`}
                  className={styles.step}
                >
                  {/* 번호 + 연결선 */}
                  <div className={styles.stepRail}>
                    <div className={styles.stepNumber}>
                      {i + 1}
                    </div>
                    {i < wf.steps.length - 1 && (
                      <div className={styles.stepLine} />
                    )}
                  </div>
                  <div className={styles.stepText}>
                    <div className={styles.stepTitle}>
                      {step.title}
                    </div>
                    <div className={styles.stepDescription}>
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 직접 해보기 버튼 */}
            {wf.tourPath && wf.tourSteps?.length ? (
              <button
                type="button"
                onClick={handleTour}
                className={styles.tourButton}
              >
                직접 해보기
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.tourIcon}
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   페이지
   ================================================================ */
export default function GuidePage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = useCallback(
    (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    [],
  );

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <h1 className={styles.pageTitle}>
          사용 가이드
        </h1>
        <p className={styles.pageDescription}>
          주요 기능을 단계별로 안내해요. 카드를 눌러 확인하고, '직접 해보기'로
          실제 화면에서 따라해 보세요.
        </p>
      </div>

      <div className={styles.workflowList}>
        {STUDENT_WORKFLOWS.map((wf) => (
          <WorkflowCard
            key={wf.id}
            wf={wf}
            open={openId === wf.id}
            onToggle={() => toggle(wf.id)}
          />
        ))}
      </div>
    </div>
  );
}
