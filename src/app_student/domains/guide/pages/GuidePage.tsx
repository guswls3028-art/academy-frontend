/**
 * 학생앱 사용 가이드 — 업무 흐름 중심 워크플로우 + 아코디언 + 투어
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGuideTour } from "@/shared/ui/guide";
import type { GuideWorkflow } from "@/shared/ui/guide";
import { STUDENT_WORKFLOWS } from "../data/studentWorkflows";
import styles from "./GuidePage.module.css";

const START_TIPS = [
  {
    title: "처음에는 홈 화면부터",
    description: "오늘 수업, 공지, 과제, 시험이 한곳에 모입니다.",
  },
  {
    title: "학부모는 휴대폰 번호로",
    description: "학원에 등록된 학부모 휴대폰 번호가 로그인 기준입니다.",
  },
  {
    title: "목록이 비어 있으면",
    description: "선생님이 아직 강의나 과제를 배정하지 않은 상태일 수 있어요.",
  },
];

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
        <p className={styles.eyebrow}>공식 학생 가이드</p>
        <h1 className={styles.pageTitle}>
          처음 로그인했다면 이 순서로 확인하세요.
        </h1>
        <p className={styles.pageDescription}>
          홈에서 오늘 할 일을 보고, 필요한 기능만 하나씩 열어 보면 됩니다.
          카드를 누르면 자세한 단계가 펼쳐지고, '직접 해보기'로 실제 화면에서 따라해 볼 수 있어요.
        </p>
      </div>

      <div className={styles.tipGrid} aria-label="처음 이용 안내">
        {START_TIPS.map((tip) => (
          <div key={tip.title} className={styles.tipItem}>
            <strong>{tip.title}</strong>
            <span>{tip.description}</span>
          </div>
        ))}
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
