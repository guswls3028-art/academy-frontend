import type { Exam } from "../../types";

function deriveState(exam: Exam) {
  // ✅ 서버 단일진실 기반 파생 (프론트 표시용)
  // - is_active + open_at/close_at로 Badge 상태만 계산
  const now = new Date();

  const openAt = exam.open_at ? new Date(exam.open_at) : null;
  const closeAt = exam.close_at ? new Date(exam.close_at) : null;

  if (!exam.is_active) {
    return { key: "inactive" as const, label: "비활성" };
  }

  if (openAt && now < openAt) {
    return { key: "scheduled" as const, label: "예정" };
  }

  if (closeAt && now > closeAt) {
    return { key: "closed" as const, label: "종료" };
  }

  // open_at/close_at이 없거나, 현재가 구간 안이면 진행중으로 본다
  return { key: "open" as const, label: "진행중" };
}

function Badge({ state }: { state: ReturnType<typeof deriveState> }) {
  const cls =
    state.key === "open"
      ? "bg-emerald-600/10 text-emerald-700"
      : state.key === "scheduled"
      ? "bg-blue-600/10 text-blue-700"
      : state.key === "closed"
      ? "bg-gray-600/10 text-gray-700"
      : "bg-red-600/10 text-red-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs ${cls}`}>
      {state.label}
    </span>
  );
}

export default function ExamHeader({ exam }: { exam: Exam }) {
  const state = deriveState(exam);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{exam.title}</h2>
          <div className="text-xs text-muted">
            {exam.exam_type === "template" ? "템플릿" : "운영"} ·{" "}
            {exam.subject || "과목 미지정"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge state={state} />
        </div>
      </div>

      {exam.description?.trim() && (
        <div className="text-sm text-muted whitespace-pre-wrap">
          {exam.description}
        </div>
      )}

      <div className="text-xs text-muted">
        ※ 성적 입력 · 채점 · 판정은 <b>세션 &gt; 성적</b> 도메인이 단일진실입니다.
      </div>
    </div>
  );
}
