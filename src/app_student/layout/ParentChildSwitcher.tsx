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
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/auth/context/AuthContext";
import { cx } from "@/shared/utils/cx";
import {
  isStudentScopedQueryKey,
  setParentStudentId,
} from "@/shared/api/parentStudentSelection";
import styles from "./ParentChildSwitcher.module.css";

type Props = {
  selectedStudentId: number | null;
  onSelectionChange: (studentId: number) => void;
  variant?: "bar" | "gate";
};

export default function ParentChildSwitcher({
  selectedStudentId,
  onSelectionChange,
  variant = "bar",
}: Props) {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isParent = user?.tenantRole === "parent";
  const linked = useMemo(() => user?.linkedStudents ?? [], [user?.linkedStudents]);

  const [switchingId, setSwitchingId] = useState<number | null>(null);

  if (!isParent || linked.length < 2) return null;

  const handleSelect = (id: number) => {
    if (id === selectedStudentId || switchingId != null || user == null) return;
    const studentScopePredicate = (query: { queryKey: readonly unknown[] }) =>
      isStudentScopedQueryKey(query.queryKey);
    setSwitchingId(id);
    void (async () => {
      /* 이전 자녀 요청을 먼저 취소하고 캐시에서 제거한다. resetQueries는 이전
       * 화면의 queryFn을 다시 실행해 바뀐 전역 헤더와 섞을 수 있으므로 쓰지 않는다. */
      await qc.cancelQueries({ predicate: studentScopePredicate });
      qc.removeQueries({ predicate: studentScopePredicate });
      setParentStudentId(id, user.id);
      onSelectionChange(id);
      navigate("/student/dashboard");
    })().finally(() => setSwitchingId(null));
  };

  return (
    <div
      role="tablist"
      aria-label="자녀 선택"
      className={cx(styles.root, variant === "gate" && styles.rootGate)}
    >
      <span className={styles.label}>
        자녀
      </span>
      {linked.map((s) => {
        const active = s.id === selectedStudentId;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-busy={switchingId === s.id || undefined}
            disabled={switchingId != null}
            onClick={() => handleSelect(s.id)}
            className={cx(styles.tab, variant === "gate" && styles.tabGate, active && styles.tabActive)}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
