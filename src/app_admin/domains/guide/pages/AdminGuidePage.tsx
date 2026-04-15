/**
 * 선생앱(관리자) 사용 가이드 — 업무 흐름 중심 워크플로우 + 아코디언 + 투어
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { useGuideTour } from "@/shared/ui/guide";
import type { GuideWorkflow } from "@/shared/ui/guide";
import { ADMIN_WORKFLOWS } from "../data/adminWorkflows";

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
    <div
      style={{
        borderRadius: 14,
        border: `1.5px solid ${open ? "var(--color-brand-primary)" : "var(--color-border-divider)"}`,
        background: "var(--color-bg-surface)",
        transition: "border-color 200ms, box-shadow 200ms",
        boxShadow: open ? "0 2px 12px rgba(0,0,0,0.06)" : "none",
        overflow: "hidden",
      }}
    >
      {/* 헤더 — 클릭으로 펼침/접힘 */}
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          padding: "16px 18px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--color-text-primary)",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background:
              "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)",
            color: "var(--color-brand-primary)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {wf.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{wf.title}</div>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-secondary)",
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            {wf.summary}
          </div>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transition: "transform 250ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 아코디언 본문 — grid-template-rows 트랜지션 */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 300ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "0 18px 18px",
              borderTop: "1px solid var(--color-border-divider)",
            }}
          >
            {/* 단계 목록 */}
            <div style={{ marginTop: 16 }}>
              {wf.steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: i < wf.steps.length - 1 ? 14 : 0,
                    position: "relative",
                  }}
                >
                  {/* 번호 원 + 연결선 */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background:
                          "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
                        color: "var(--color-brand-primary)",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    {i < wf.steps.length - 1 && (
                      <div
                        style={{
                          width: 2,
                          flex: 1,
                          minHeight: 10,
                          background:
                            "color-mix(in srgb, var(--color-brand-primary) 15%, transparent)",
                          marginTop: 4,
                        }}
                      />
                    )}
                  </div>
                  <div style={{ paddingTop: 2 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "var(--color-text-primary)",
                        marginBottom: 2,
                      }}
                    >
                      {step.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 직접 해보기 버튼 */}
            {wf.tourPath && wf.tourSteps?.length ? (
              <button
                onClick={handleTour}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 18,
                  padding: "8px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--color-brand-primary)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 150ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
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
