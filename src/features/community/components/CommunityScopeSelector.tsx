// PATH: src/features/community/components/CommunityScopeSelector.tsx
// 노출 범위 선택: 통합 | 강의별 | 세션별 (CommunityScopeContext 연동)

import { useQuery } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import { fetchLectures } from "@/features/lectures/api/sessions";
import { fetchSessions } from "@/features/lectures/api/sessions";
import "@/features/community/community.css";

export default function CommunityScopeSelector() {
  const { scope, setScope, lectureId, setLectureId, sessionId, setSessionId } = useCommunityScope();

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures-list"],
    queryFn: () => fetchLectures({ is_active: true }),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["lecture-sessions", lectureId],
    queryFn: () => fetchSessions(lectureId!),
    enabled: scope !== "all" && lectureId != null && Number.isFinite(lectureId),
  });

  return (
    <div className="community-scope-bar">
      <span className="community-scope-bar__label">노출 범위</span>
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
        <option value="session">차시별</option>
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
          {[...sessions]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((s) => {
              const isSupplement = (s.title ?? "").includes("보강");
              const label = isSupplement ? "보강" : `${s.order}차시`;
              const dateStr = s.date ? ` (${new Date(s.date).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })})` : "";
              return (
                <option key={s.id} value={s.id}>
                  {label}{dateStr}
                </option>
              );
            })}
        </select>
      )}
    </div>
  );
}
