/**
 * ExamPolicyPanel – FINAL / HUMAN / SAFE
 *
 * WHY:
 * - exam 정책은 setup 패널의 핵심이므로 self-contained
 * - 비동기 로딩 / PATCH / dirty 판단을 내부에서 모두 책임
 * - pass_score / is_active만 제어 (results 단일진실 유지)
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminExam } from "../../hooks/useAdminExam";
import { updateAdminExam } from "../../api/adminExam";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function ExamPolicyPanel({ examId }: { examId: number }) {
  const qc = useQueryClient();
  const { data: exam, isLoading } = useAdminExam(examId);

  const [passScore, setPassScore] = useState<number | "">("");
  const [savedScore, setSavedScore] = useState<number | "">("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!exam) return;
    const ps = Number(exam.pass_score);
    const value = Number.isFinite(ps) && ps > 0 ? ps : "";
    setPassScore(value);
    setSavedScore(value);
    setIsActive(Boolean(exam.is_active));
  }, [exam?.id]);

  const isDirty = useMemo(
    () => passScore !== savedScore,
    [passScore, savedScore]
  );

  const numericPassScore = typeof passScore === "number" ? passScore : 0;

  const patchMut = useMutation({
    mutationFn: (payload: {
      pass_score: number;
      is_active: boolean;
    }) => updateAdminExam(examId, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-exam", examId] });
      feedback.success("저장되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "저장에 실패했습니다.");
    },
  });

  if (isLoading || !exam) {
    return (
      <section className="rounded border bg-[var(--bg-surface-soft)] p-4 text-sm text-[var(--text-muted)]">
        시험 정책을 불러오는 중입니다…
      </section>
    );
  }

  const savePassScore = async () => {
    try {
      await patchMut.mutateAsync({
        pass_score: numericPassScore,
        is_active: isActive,
      });
      setSavedScore(passScore);
    } catch {
      // onError에서 이미 feedback 처리
    }
  };

  const toggleActive = async () => {
    const next = !isActive;
    setIsActive(next);
    await patchMut.mutateAsync({
      pass_score: numericPassScore,
      is_active: next,
    });
  };

  return (
    <section className="space-y-6 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-5">
      <div>
        <div className="text-lg font-semibold">시험 정책</div>
        <div className="text-xs text-muted">
          커트라인과 시험 진행 상태를 설정합니다
        </div>
      </div>

      <div className="flex items-end gap-6">
        <div>
          <div className="mb-1 text-sm text-muted">커트라인</div>
          <input
            type="number"
            min={0}
            step={1}
            value={passScore === "" ? "" : passScore}
            onChange={(e) => {
              const v = e.target.value;
              setPassScore(v === "" ? "" : Number(e.target.value));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (isDirty && !patchMut.isPending)) {
                e.preventDefault();
                savePassScore();
              }
            }}
            placeholder="입력"
            className="w-[180px] rounded border px-3 py-2 text-4xl font-bold"
            disabled={patchMut.isPending}
          />
        </div>

        <Button
          type="button"
          intent="primary"
          size="md"
          onClick={savePassScore}
          disabled={!isDirty || patchMut.isPending}
        >
          저장
        </Button>

        <Button
          type="button"
          intent={isActive ? "secondary" : "danger"}
          size="md"
          onClick={toggleActive}
          disabled={patchMut.isPending}
        >
          {isActive ? "진행중" : "종료"}
        </Button>
      </div>

      <div className="text-xs text-muted">
        • 합격/불합격 판정은 Results 도메인에서 자동 계산됩니다.<br />
        • 시험 시작/종료 시점은 세션 일정과 연동됩니다.
      </div>
    </section>
  );
}
