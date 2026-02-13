// PATH: src/features/community/components/CommunityScopeSelector.tsx
// 노출 범위 선택: 통합 | 강의별 | 세션별 (CommunityScopeContext 연동)

import { useQuery } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import { fetchLectures } from "@/features/lectures/api/sessions";
import { fetchSessions } from "@/features/lectures/api/sessions";

const WRAPPER_STYLE = {
  padding: "var(--space-3) 0",
  borderBottom: "1px solid var(--color-border-divider)",
  marginBottom: "var(--space-4)",
};

export default function CommunityScopeSelector() {
  const { scope, setScope, lectureId, setLectureId, sessionId, setSessionId } = useCommunityScope();

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures-list"],
    queryFn: () => fetchLectures({ is_active: true }),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: () => fetchSessions(lectureId!),
    enabled: scope !== "all" && Number.isFinite(lectureId ?? 0),
  });

  return (
    <div className="flex flex-wrap items-center gap-3" style={WRAPPER_STYLE}>
      <span
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--font-title)",
          color: "var(--color-text-secondary)",
        }}
      >
        노출 범위
      </span>
      <select
        className="ds-input"
        value={scope}
        onChange={(e) => {
          const v = e.target.value as "all" | "lecture" | "session";
          setScope(v);
          if (v === "all") {
            setLectureId(null);
            setSessionId(null);
          } else if (v === "lecture") {
            setSessionId(null);
          }
        }}
        style={{ width: 140 }}
      >
        <option value="all">통합 (전체 학생)</option>
        <option value="lecture">강의별</option>
        <option value="session">세션별</option>
      </select>

      {(scope === "lecture" || scope === "session") && (
        <select
          className="ds-input"
          value={lectureId ?? ""}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : null;
            setLectureId(v);
            setSessionId(null);
          }}
          style={{ width: 220 }}
        >
          <option value="">강의 선택</option>
          {lectures.map((lec) => (
            <option key={lec.id} value={lec.id}>
              {lec.title}
            </option>
          ))}
        </select>
      )}

      {scope === "session" && lectureId && (
        <select
          className="ds-input"
          value={sessionId ?? ""}
          onChange={(e) => setSessionId(e.target.value ? Number(e.target.value) : null)}
          style={{ width: 200 }}
        >
          <option value="">차시 선택</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.order}차시 · {s.title || "제목 없음"}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
