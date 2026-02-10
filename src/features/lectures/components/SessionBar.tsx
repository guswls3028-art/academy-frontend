// PATH: src/features/lectures/components/SessionBar.tsx
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import SessionCreateModal from "./SessionCreateModal";
import { useLectureParams } from "../hooks/useLectureParams";
import { Button } from "@/shared/ui/ds";

export default function SessionBar() {
  const { lectureId } = useLectureParams();
  const location = useLocation();

  if (!Number.isFinite(lectureId)) return null;

  const [showModal, setShowModal] = useState(false);

  const { data: sessions = [] } = useQuery({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: async () => {
      const res = await api.get(`/lectures/sessions/?lecture=${lectureId}`);
      return res.data.results ?? res.data;
    },
  });

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 6,
        }}
      >
        {sessions.map((s: any) => {
          const active = location.pathname.includes(`/sessions/${s.id}`);

          return (
            <Link
              key={s.id}
              to={`sessions/${s.id}`}
              style={{
                flex: "0 0 auto",
                minWidth: 168,
                borderRadius: 999,
                border: active ? "1px solid var(--color-primary)" : "1px solid var(--color-border-divider)",
                background: active ? "var(--color-primary)" : "var(--color-bg-surface)",
                padding: "10px 14px",
                textDecoration: "none",
                boxShadow: active ? "0 1px 0 rgba(0,0,0,0.06)" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 950,
                  color: active ? "#fff" : "var(--color-text-primary)",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                }}
              >
                {s.order ?? "?"}차시
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: 850,
                  color: active ? "rgba(255,255,255,0.85)" : "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.date || "-"}
              </div>
            </Link>
          );
        })}

        <Button
          intent="ghost"
          onClick={() => setShowModal(true)}
          style={{
            flex: "0 0 auto",
            minWidth: 168,
            borderRadius: 999,
            border: "1px dashed var(--color-border-divider)",
            background: "var(--color-bg-surface)",
            color: "var(--color-text-muted)",
            fontWeight: 900,
          }}
        >
          + 차시 추가
        </Button>
      </div>

      {showModal && (
        <SessionCreateModal
          lectureId={lectureId}
          sessionCount={sessions.length}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
