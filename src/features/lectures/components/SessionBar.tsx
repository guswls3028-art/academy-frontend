// PATH: src/features/lectures/components/SessionBar.tsx
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import api from "@/shared/api/axios";
import SessionCreateModal from "./SessionCreateModal";
import { useLectureParams } from "../hooks/useLectureParams";
import "@/shared/ui/session-block/session-block.css";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function isSupplement(title: string | null | undefined): boolean {
  return Boolean(title?.includes?.("보강"));
}

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
        {sessions.map((s: { id: number; order?: number; date?: string | null; title?: string | null }) => {
          const active = location.pathname.includes(`/sessions/${s.id}`);
          const supplement = isSupplement(s.title);

          return (
            <Link
              key={s.id}
              to={`sessions/${s.id}`}
              className={cx(
                "session-block session-block--compact",
                supplement ? "session-block--supplement" : "session-block--n1",
                active && "session-block--selected"
              )}
            >
              <span className="session-block__title">{s.order ?? "?"}차시</span>
              <span className="session-block__desc">{s.date || "-"}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="session-block session-block--compact session-block--add"
        >
          <span className="session-block__title">+ 차시 추가</span>
        </button>
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
