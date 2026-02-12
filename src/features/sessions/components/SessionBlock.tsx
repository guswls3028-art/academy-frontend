// PATH: src/features/sessions/components/SessionBlock.tsx
// 차시 = 세션 — lecture 기준 세션 목록 + 추가 (LectureLayout, SessionLayout 공용)

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSessions } from "@/features/lectures/api/sessions";
import SessionCreateModal from "@/features/lectures/components/SessionCreateModal";

interface Props {
  lectureId: number;
  /** 현재 세션 ID (SessionLayout일 때 활성 표시용) */
  currentSessionId?: number;
}

export default function SessionBlock({ lectureId, currentSessionId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: () => fetchSessions(lectureId),
    enabled: Number.isFinite(lectureId),
  });

  const handleClose = () => {
    setShowCreate(false);
    qc.invalidateQueries({ queryKey: ["lecture-sessions", lectureId] });
    qc.invalidateQueries({ queryKey: ["session"] });
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          flexWrap: "wrap",
          paddingBottom: "var(--space-4)",
          marginBottom: "var(--space-4)",
          borderBottom: "1px solid var(--color-border-divider)",
        }}
      >
        {isLoading ? (
          <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>불러오는 중…</span>
        ) : (
          <>
            {sessions.map((s: any) => {
              const isActive =
                currentSessionId != null && Number(s.id) === Number(currentSessionId);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    navigate(`/admin/lectures/${lectureId}/sessions/${s.id}`)
                  }
                  style={{
                    padding: "10px 20px",
                    borderRadius: "var(--radius-lg)",
                    border: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border-divider)"}`,
                    background: isActive
                      ? "color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-surface))"
                      : "var(--color-bg-surface)",
                    fontSize: 15,
                    fontWeight: 600,
                    color: isActive ? "var(--color-primary)" : "var(--color-text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {s.order ?? "-"}차시
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={{
                padding: "10px 20px",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-primary)",
                background: "color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-surface))",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--color-primary)",
                cursor: "pointer",
              }}
            >
              + 차시 추가
            </button>
          </>
        )}
      </div>

      {showCreate && (
        <SessionCreateModal lectureId={lectureId} onClose={handleClose} />
      )}
    </>
  );
}
