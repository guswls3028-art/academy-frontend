/**
 * 학부모 자녀 스위처 — 헤더 바로 아래
 *
 * 표시 조건: 로그인 사용자가 학부모이고, linkedStudents가 2명 이상.
 * 동작: 칩 클릭 시 setParentStudentId + queryClient 캐시 클리어 + 홈으로 이동.
 *      자녀 1명일 때는 노출하지 않음(공간 낭비).
 *
 * 캐시 격리: 자녀 전환은 X-Student-Id 헤더에 의존하므로 모든 student 쿼리를
 * 무효화해야 안전. queryClient.clear()는 로그인 등 비-student 쿼리도 비우므로
 * 'student' prefix만 제거하는 형태로 좁힘.
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
    /* 자녀별 쿼리 격리가 필요한 키 prefix들 — 학생 도메인 전체. */
    qc.removeQueries({ queryKey: ["student"] });
    qc.removeQueries({ queryKey: ["student-dashboard"] });
    qc.removeQueries({ queryKey: ["student-sessions"] });
    qc.removeQueries({ queryKey: ["student-session"] });
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
