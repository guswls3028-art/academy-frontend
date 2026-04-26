/**
 * 학부모 자녀 스위처 — 헤더 바로 아래
 *
 * 표시 조건: 로그인 사용자가 학부모이고, linkedStudents가 2명 이상.
 * 동작: 칩 클릭 시 setParentStudentId + queryClient 캐시 클리어 + 홈으로 이동.
 *      자녀 1명일 때는 노출하지 않음(공간 낭비).
 *
 * 캐시 격리: 자녀 전환은 X-Student-Id 헤더에 의존하므로 학생 스코프 쿼리를
 * 모두 무효화해야 안전. 학생 쿼리는 키 첫 토큰이 다음 두 패턴 중 하나:
 *   1) "student" — 예: ["student", "qna", "questions"]
 *   2) "student-XXX" — 예: ["student-dashboard"], ["student-video-playback", ...]
 * React Query의 prefix 매칭은 ["student"]로 student-* 를 잡지 못하므로 predicate 사용.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/auth/context/AuthContext";
import {
  getParentStudentId,
  initParentStudentId,
  setParentStudentId,
} from "@student/shared/api/parentStudentSelection";

export default function ParentChildSwitcher() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isParent = user?.tenantRole === "parent";
  const linked = user?.linkedStudents ?? [];

  /* module-level state(getParentStudentId)를 컴포넌트 state로 동기화 — 칩 활성 표시용 */
  const [currentId, setCurrentId] = useState<number | null>(() => getParentStudentId());

  useEffect(() => {
    if (linked.length === 0) return;
    const ids = linked.map((s) => s.id);
    let id = getParentStudentId();
    if (id == null || !ids.includes(id)) {
      id = initParentStudentId(ids);
    }
    setCurrentId(id);
  }, [linked]);

  if (!isParent || linked.length < 2) return null;

  const handleSelect = (id: number) => {
    if (id === currentId) return;
    setParentStudentId(id);
    setCurrentId(id);
    /* invalidate로 stale 마킹 + 자동 refetch — 활성 쿼리는 이전 데이터를 잠깐
     * 보여주다 새 자녀 데이터로 매끄럽게 전환. removeQueries는 즉시 캐시 비우기라
     * 아바타/이름이 잠깐 "?"로 깨지는 깜빡임이 발생해서 대신 invalidate 사용.
     * Predicate: 학생 스코프 쿼리(student / student-* / clinic-idcard / video-comments
     * / storage-quota) 전부 매칭. 누락 시 자녀 A의 stale 데이터가 자녀 B 화면에 노출. */
    qc.invalidateQueries({
      predicate: (query) => {
        const head = query.queryKey[0];
        if (typeof head !== "string") return false;
        return (
          head === "student" ||
          head.startsWith("student-") ||
          head === "clinic-idcard" ||
          head === "video-comments" ||
          head === "storage-quota"
        );
      },
    });
    navigate("/student/dashboard");
  };

  return (
    <div
      role="tablist"
      aria-label="자녀 선택"
      style={{
        display: "flex",
        gap: 6,
        padding: "8px var(--stu-space-4)",
        borderBottom: "1px solid var(--stu-border)",
        background: "var(--stu-surface)",
        overflowX: "auto",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--stu-text-muted)", letterSpacing: "0.04em", alignSelf: "center", flexShrink: 0, marginRight: 4 }}>
        자녀
      </span>
      {linked.map((s) => {
        const active = s.id === currentId;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => handleSelect(s.id)}
            style={{
              flexShrink: 0,
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              cursor: "pointer",
              border: active
                ? "1px solid var(--stu-primary)"
                : "1px solid var(--stu-border)",
              background: active
                ? "color-mix(in srgb, var(--stu-primary) 14%, var(--stu-surface-1))"
                : "var(--stu-surface)",
              color: active ? "var(--stu-primary)" : "var(--stu-text)",
              transition: "background 150ms, color 150ms, border-color 150ms",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
