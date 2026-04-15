/**
 * 학생앱 사용 가이드 — 업무 흐름 중심 워크플로우 + 아코디언 + 투어
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGuideTour } from "@/shared/ui/guide";
import type { GuideWorkflow } from "@/shared/ui/guide";
import { STUDENT_WORKFLOWS } from "../data/studentWorkflows";

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
        borderRadius: "var(--stu-radius-md)",
        border: `1.5px solid ${open ? "var(--stu-primary)" : "var(--stu-border)"}`,
        background: "var(--stu-surface)",
        transition: "border-color 200ms, box-shadow 200ms",
        boxShadow: open ? "0 2px 12px rgba(0,0,0,0.06)" : "none",
        overflow: "hidden",
      }}
    >
      {/* 헤더 */}
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "14px 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--stu-text)",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "var(--stu-radius)",
            background:
              "color-mix(in srgb, var(--stu-primary) 10%, transparent)",
            color: "var(--stu-primary)",
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
              color: "var(--stu-text-muted)",
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
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
          style={{
            flexShrink: 0,
            transition: "transform 250ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 아코디언 본문 */}
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
              padding: "0 16px 16px",
              borderTop: "1px solid var(--stu-border)",
            }}
          >
            {/* 단계 목록 */}
            <div style={{ marginTop: 14 }}>
              {wf.steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: i < wf.steps.length - 1 ? 12 : 0,
                  }}
                >
                  {/* 번호 + 연결선 */}
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
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background:
                          "color-mix(in srgb, var(--stu-primary) 12%, transparent)",
                        color: "var(--stu-primary)",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {i + 1}
                    </div>
                    {i < wf.steps.length - 1 && (
                      <div
                        style={{
                          width: 2,
                          flex: 1,
                          minHeight: 8,
                          background:
                            "color-mix(in srgb, var(--stu-primary) 15%, transparent)",
                          marginTop: 4,
                        }}
                      />
                    )}
                  </div>
                  <div style={{ paddingTop: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "var(--stu-text)",
                        marginBottom: 2,
                      }}
                    >
                      {step.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "var(--stu-text-muted)",
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
                  marginTop: 16,
                  padding: "8px 16px",
                  borderRadius: "var(--stu-radius)",
                  border: "none",
                  background: "var(--stu-primary)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
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
export default function GuidePage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = useCallback(
    (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    [],
  );

  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      <div style={{ marginBottom: "var(--stu-space-5)" }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "var(--stu-text)",
            marginBottom: "var(--stu-space-2)",
          }}
        >
          사용 가이드
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--stu-text-muted)",
            lineHeight: 1.5,
          }}
        >
          주요 기능을 단계별로 안내해요. 카드를 눌러 확인하고, '직접 해보기'로
          실제 화면에서 따라해 보세요.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--stu-space-3)",
        }}
      >
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
