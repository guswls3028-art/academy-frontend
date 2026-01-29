// src/features/lectures/components/SessionBar.tsx

import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import SessionCreateModal from "./SessionCreateModal";
import { useLectureParams } from "../hooks/useLectureParams";

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
    <div className="mb-6">
      <div
        className="
          flex gap-3 overflow-x-auto pb-2
          scrollbar-thin scrollbar-thumb-gray-300
        "
      >
        {sessions.map((s: any) => {
          const active = location.pathname.includes(`/sessions/${s.id}`);

          return (
            <Link
              key={s.id}
              to={`sessions/${s.id}`}
              className={[
                "min-w-[150px] rounded-full px-5 py-3 text-sm transition-all",
                "border",
                active
                  ? `
                    border-[var(--color-primary)]
                    bg-[var(--color-primary)]
                    text-white
                    shadow-sm
                  `
                  : `
                    border-[var(--border-divider)]
                    bg-[var(--bg-surface-soft)]
                    text-[var(--text-primary)]
                    hover:bg-[var(--bg-surface)]
                  `,
              ].join(" ")}
            >
              <div className="font-semibold">
                {s.order ?? "?"}차시
              </div>

              {s.date && (
                <div
                  className={[
                    "mt-0.5 text-xs",
                    active ? "text-white/80" : "text-[var(--text-muted)]",
                  ].join(" ")}
                >
                  {s.date}
                </div>
              )}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="
            min-w-[150px]
            rounded-full
            border-2 border-dashed
            border-[var(--border-divider)]
            px-5 py-3
            text-sm font-medium
            text-[var(--text-muted)]
            bg-[var(--bg-surface)]
            hover:border-[var(--color-primary)]
            hover:text-[var(--color-primary)]
            hover:bg-[var(--bg-surface-soft)]
            transition
          "
        >
          + 차시 추가
        </button>
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
