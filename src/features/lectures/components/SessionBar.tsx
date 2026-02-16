// PATH: src/features/lectures/components/SessionBar.tsx
import { useLocation } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import api from "@/shared/api/axios";
import SessionCreateModal from "./SessionCreateModal";
import { useLectureParams } from "../hooks/useLectureParams";
import { sortSessionsByDateDesc } from "../api/sessions";
import { SessionBlockView, isSupplement } from "@/shared/ui/session-block";

export default function SessionBar() {
  const { lectureId } = useLectureParams();
  const location = useLocation();

  if (!Number.isFinite(lectureId)) return null;

  const [showModal, setShowModal] = useState(false);

  const { data: rawSessions = [] } = useQuery({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: async () => {
      const res = await api.get(`/lectures/sessions/?lecture=${lectureId}`);
      return res.data.results ?? res.data;
    },
  });
  const sessions = sortSessionsByDateDesc(Array.isArray(rawSessions) ? rawSessions : []);

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
        {sessions.map((s: { id: number; order?: number; date?: string | null; title?: string | null }) => {
          const active = location.pathname.includes(`/sessions/${s.id}`);
          const supplement = isSupplement(s.title);

          return (
            <SessionBlockView
              key={s.id}
              variant={supplement ? "supplement" : "n1"}
              compact
              to={`sessions/${s.id}`}
              selected={active}
              title={`${s.order ?? "?"}차시`}
              desc={s.date || "-"}
            />
          );
        })}

        <SessionBlockView
          variant="add"
          compact
          onClick={() => setShowModal(true)}
          ariaLabel="차시 추가"
        >
          <Plus size={22} strokeWidth={2.5} />
        </SessionBlockView>
      </div>

      {showModal && (
        <SessionCreateModal
          lectureId={lectureId}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
