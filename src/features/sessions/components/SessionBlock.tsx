// PATH: src/features/sessions/components/SessionBlock.tsx
// 차시 = 세션 — lecture 기준 세션 목록 + 추가 (LectureLayout, SessionLayout 공용). 차시 블록 SSOT 사용

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { fetchSessions } from "@/features/lectures/api/sessions";
import SessionCreateModal from "@/features/lectures/components/SessionCreateModal";
import { SessionBlockView, isSupplement } from "@/shared/ui/session-block";

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
            {(sessions as { id: number; order?: number; date?: string | null; title?: string | null }[]).map((s) => {
              const isActive =
                currentSessionId != null && Number(s.id) === Number(currentSessionId);
              const supplement = isSupplement(s.title);

              return (
                <SessionBlockView
                  key={s.id}
                  variant={supplement ? "supplement" : "n1"}
                  compact
                  selected={isActive}
                  title={`${s.order ?? "-"}차시`}
                  desc={s.date ?? "-"}
                  onClick={() =>
                    navigate(`/admin/lectures/${lectureId}/sessions/${s.id}`)
                  }
                />
              );
            })}
            <SessionBlockView
              variant="add"
              compact
              onClick={() => setShowCreate(true)}
              ariaLabel="차시 추가"
            >
              <Plus size={22} strokeWidth={2.5} />
            </SessionBlockView>
          </>
        )}
      </div>

      {showCreate && (
        <SessionCreateModal lectureId={lectureId} onClose={handleClose} />
      )}
    </>
  );
}
