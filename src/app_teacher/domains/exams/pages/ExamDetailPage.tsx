// PATH: src/app_teacher/domains/exams/pages/ExamDetailPage.tsx
// 시험 상세 — 제출현황 + 간이 채점 + 관리
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Settings, Camera } from "@teacher/shared/ui/Icons";
import { fetchExam, fetchExamResults } from "../api";
import ExamManageSheet from "../components/ExamManageSheet";
import api from "@/shared/api/axios";

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const eid = Number(examId);
  const [manageOpen, setManageOpen] = useState(false);

  const { data: exam, isLoading: loadingExam } = useQuery({
    queryKey: ["teacher-exam", eid],
    queryFn: () => fetchExam(eid),
    enabled: Number.isFinite(eid),
  });

  const { data: results, isLoading: loadingResults } = useQuery({
    queryKey: ["teacher-exam-results", eid],
    queryFn: () => fetchExamResults(eid),
    enabled: Number.isFinite(eid),
  });

  if (loadingExam || loadingResults)
    return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!exam) return <EmptyState scope="panel" tone="error" title="시험을 찾을 수 없습니다" />;

  const graded = results?.filter((r: any) => r.score != null) ?? [];
  const ungraded = results?.filter((r: any) => r.score == null) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1 truncate" style={{ color: "var(--tc-text)" }}>
          {exam.title}
        </h1>
        <button onClick={() => navigate(`/teacher/exams/${eid}/omr`)}
          className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
          style={{ padding: "6px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-primary)", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
          <Camera size={12} /> OMR
        </button>
        <button onClick={() => setManageOpen(true)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
          <Settings size={18} />
        </button>
      </div>

      {/* Summary */}
      <div
        className="grid grid-cols-3 gap-2 rounded-xl"
        style={{ padding: "var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
      >
        <StatBox label="만점" value={exam.max_score ?? "-"} />
        <StatBox label="제출" value={`${results?.length ?? 0}`} color="var(--tc-primary)" />
        <StatBox label="채점" value={`${graded.length}`} color="var(--tc-success)" />
      </div>

      {/* Ungraded list */}
      {ungraded.length > 0 && (
        <div
          className="rounded-xl"
          style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--tc-text)" }}>
            채점 대기 ({ungraded.length})
          </h3>
          <div className="flex flex-col gap-1">
            {ungraded.map((r: any) => (
              <ResultRow key={r.id} result={r} maxScore={exam.max_score} />
            ))}
          </div>
        </div>
      )}

      {/* Graded list */}
      {graded.length > 0 && (
        <div
          className="rounded-xl"
          style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)", padding: "var(--tc-space-4)" }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--tc-text)" }}>
            채점 완료 ({graded.length})
          </h3>
          <div className="flex flex-col gap-1">
            {graded.map((r: any) => (
              <ResultRow key={r.id} result={r} maxScore={exam.max_score} />
            ))}
          </div>
        </div>
      )}

      {results?.length === 0 && (
        <EmptyState scope="panel" tone="empty" title="제출된 결과가 없습니다" />
      )}

      <ExamManageSheet open={manageOpen} onClose={() => setManageOpen(false)} exam={exam} onDeleted={() => navigate(-1)} />
    </div>
  );
}

function ResultRow({ result, maxScore }: { result: any; maxScore: number }) {
  const qc = useQueryClient();
  const name = result.student_name ?? result.enrollment_name ?? "이름 없음";

  const mutation = useMutation({
    mutationFn: (score: number) => api.patch(`/results/${result.id}/`, { score }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-exam-results"] });
    },
  });

  const handleScore = () => {
    const input = prompt(`${name} 점수 입력 (만점 ${maxScore}):`, result.score?.toString() ?? "");
    if (input == null) return;
    const score = Number(input);
    if (!Number.isFinite(score) || score < 0) return;
    mutation.mutate(score);
  };

  return (
    <div className="flex justify-between items-center py-2 border-b last:border-b-0" style={{ borderColor: "var(--tc-border)" }}>
      <span className="text-sm" style={{ color: "var(--tc-text)" }}>{name}</span>
      <button
        onClick={handleScore}
        className="text-sm font-semibold px-3 py-1 rounded cursor-pointer"
        style={{
          background: result.score != null ? "var(--tc-success-bg)" : "var(--tc-primary-bg)",
          color: result.score != null ? "var(--tc-success)" : "var(--tc-primary)",
          border: "none",
        }}
      >
        {result.score != null ? `${result.score}점` : "채점"}
      </button>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xl font-bold" style={{ color: color ?? "var(--tc-text)" }}>
        {value}
      </span>
      <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{label}</span>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex p-1 cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
