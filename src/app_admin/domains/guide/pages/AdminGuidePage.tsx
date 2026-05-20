/**
 * 선생앱(관리자) 사용 가이드 — 업무 흐름 중심 워크플로우 + 아코디언 + 투어
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, Play } from "lucide-react";
import { DomainLayout } from "@/shared/ui/layout";
import { useGuideTour } from "@/shared/ui/guide";
import type { GuideWorkflow } from "@/shared/ui/guide";
import { ADMIN_WORKFLOWS } from "../data/adminWorkflows";
import styles from "./AdminGuidePage.module.css";

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

  const handleTour = useCallback(() => {
    if (!wf.tourPath || !wf.tourSteps?.length) return;
    startTour({ steps: wf.tourSteps });
    navigate(wf.tourPath);
  }, [wf, startTour, navigate]);

  return (
    <div className={`${styles.card} ${open ? styles.cardOpen : ""}`}>
      {/* 헤더 — 클릭으로 펼침/접힘. 우측 「시작」 버튼은 stopPropagation으로 분리 */}
      <div
        className={styles.cardHeader}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${wf.title} 카드 ${open ? "접기" : "펼치기"}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className={styles.iconBox}>
          {wf.icon}
        </div>
        <div className={styles.headerText}>
          <div className={styles.cardTitle}>{wf.title}</div>
          <div className={styles.cardSummary}>
            {wf.summary}
          </div>
        </div>
        {wf.tourPath && wf.tourSteps?.length ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTour();
            }}
            aria-label={`${wf.title} 투어 시작`}
            className={styles.startButton}
          >
            <Play size={11} fill="currentColor" aria-hidden="true" />
            시작
          </button>
        ) : null}
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </div>

      {/* 아코디언 본문 — grid-template-rows 트랜지션 */}
      <div className={`${styles.contentGrid} ${open ? styles.contentGridOpen : ""}`}>
        <div className={styles.contentClip}>
          <div className={styles.contentInner}>
            {/* 단계 목록 */}
            <div className={styles.stepList}>
              {wf.steps.map((step, i) => (
                <div key={i} className={styles.stepItem}>
                  {/* 번호 원 + 연결선 */}
                  <div className={styles.stepRail}>
                    <div className={styles.stepNumber}>
                      {i + 1}
                    </div>
                    {i < wf.steps.length - 1 && (
                      <div className={styles.stepConnector} />
                    )}
                  </div>
                  <div className={styles.stepBody}>
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
                className={styles.tryButton}
              >
                직접 해보기
                <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
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
export default function AdminGuidePage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = useCallback(
    (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    [],
  );

  return (
    <DomainLayout
      title="사용 가이드"
      description="핵심 업무를 단계별로 안내합니다. 카드를 눌러 자세한 방법을 확인하고, '직접 해보기'로 실제 화면에서 따라해 보세요."
    >
      <div className={styles.workflowList}>
        {ADMIN_WORKFLOWS.map((wf) => (
          <WorkflowCard
            key={wf.id}
            wf={wf}
            open={openId === wf.id}
            onToggle={() => toggle(wf.id)}
          />
        ))}
      </div>
    </DomainLayout>
  );
}
