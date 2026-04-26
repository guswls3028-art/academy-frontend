// PATH: src/app_admin/domains/community/components/PostHistoryTimeline.tsx
// QnA·상담 공용 — 같은 학생의 이전 게시글 타임라인 (CSS는 qna-inbox.css 공유)

import { useState } from "react";

export interface HistoryItem {
  id: number;
  title: string;
  created_at: string;
  is_answered: boolean;
}

export default function PostHistoryTimeline({
  label,
  history,
  onSelect,
}: {
  label: string;
  history: HistoryItem[];
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;

  return (
    <div className="qna-inbox__timeline">
      <button
        type="button"
        className="qna-inbox__timeline-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="qna-inbox__timeline-toggle-label">{label} {history.length}건</span>
        <span className={`qna-inbox__timeline-chevron ${open ? "qna-inbox__timeline-chevron--open" : ""}`}>▸</span>
      </button>
      {open && (
        <div className="qna-inbox__timeline-body">
          {history.map((q) => (
            <div key={q.id} className="qna-inbox__timeline-item">
              <span className="qna-inbox__timeline-dot" />
              <button type="button" onClick={() => onSelect(q.id)}>
                {new Date(q.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}{" "}
                {q.title}
              </button>
              <span className={`qna-inbox__status ${q.is_answered ? "qna-inbox__status--resolved" : "qna-inbox__status--pending"}`}>
                {q.is_answered ? "답변 완료" : "답변 대기"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
