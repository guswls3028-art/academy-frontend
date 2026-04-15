// PATH: src/app_teacher/domains/lectures/pages/SessionDetailPage.tsx
// 세션 상세 — 핵심 작업 허브. 출석/성적 바로가기
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchSession } from "../api";

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sid = Number(sessionId);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session-detail", sid],
    queryFn: () => fetchSession(sid),
    enabled: Number.isFinite(sid),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>
          {session?.title || `${session?.order ?? ""}차시`}
        </h1>
      </div>

      {session && (
        <div className="rounded-xl" style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}>
          <div className="text-sm font-semibold mb-1" style={{ color: "var(--tc-text)" }}>{session.lecture_title}</div>
          <div className="text-[13px]" style={{ color: "var(--tc-text-secondary)" }}>
            {session.date || "날짜 미정"}{session.section_label ? ` · ${session.section_label}` : ""}
          </div>
        </div>
      )}

      {/* Action cards */}
      <div className="flex flex-col gap-2">
        <ActionCard
          label="출석 체크"
          desc="스와이프로 빠르게 출석 처리"
          color="var(--tc-success)"
          onClick={() => navigate(`/teacher/attendance/${sessionId}`)}
        />
        <ActionCard
          label="성적 입력"
          desc="시험/과제 점수 입력"
          color="var(--tc-primary)"
          onClick={() => navigate(`/teacher/scores/${sessionId}`)}
        />
      </div>
    </div>
  );
}

function ActionCard({ label, desc, color, onClick }: { label: string; desc: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl w-full text-left cursor-pointer"
      style={{ padding: "var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
      >
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-bold" style={{ color: "var(--tc-text)" }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{desc}</div>
      </div>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--tc-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
