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
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/auth/context/AuthContext";
import { cx } from "@/shared/utils/cx";
import {
  getParentStudentId,
  initParentStudentId,
  isStudentScopedQueryKey,
  setParentStudentId,
} from "@student/shared/api/parentStudentSelection";
import styles from "./ParentChildSwitcher.module.css";

export default function ParentChildSwitcher() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isParent = user?.tenantRole === "parent";
  const linked = useMemo(() => user?.linkedStudents ?? [], [user?.linkedStudents]);

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
    /* 자녀 전환 직후에는 "잠깐 이전 자녀 데이터"도 노출되면 안 된다.
     * resetQueries로 활성 화면 데이터를 비우고 다시 가져오며, 비활성 학생 캐시는 제거한다. */
    const studentScopePredicate = (query: { queryKey: readonly unknown[] }) =>
      isStudentScopedQueryKey(query.queryKey);
    void qc.resetQueries({ predicate: studentScopePredicate });
    qc.removeQueries({ predicate: studentScopePredicate });
    void qc.invalidateQueries({
      predicate: studentScopePredicate,
    });
    navigate("/student/dashboard");
  };

  return (
    <div
      role="tablist"
      aria-label="자녀 선택"
      className={styles.root}
    >
      <span className={styles.label}>
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
            className={cx(styles.tab, active && styles.tabActive)}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
