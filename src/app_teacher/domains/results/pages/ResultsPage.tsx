// PATH: src/app_teacher/domains/results/pages/ResultsPage.tsx
// 성적 — 조회 + 통계 탭
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { SectionTitle, Card, TabBar } from "@teacher/shared/ui/Card";
import { Badge, AchievementBadge } from "@teacher/shared/ui/Badge";
import { fetchLectures } from "@teacher/domains/lectures/api";
import { fetchExams, fetchExamResults } from "@teacher/domains/exams/api";
import ResultsStatsTab from "@teacher/domains/results/components/ResultsStatsTab";

type Tab = "list" | "stats";

export default function ResultsPage() {
  const [tab, setTab] = useState<Tab>("list");
  const [selectedLecture, setSelectedLecture] = useState<number | null>(null);
  const [selectedExam, setSelectedExam] = useState<number | null>(null);

  const { data: lectures } = useQuery({
    queryKey: ["lectures-mobile", true],
    queryFn: () => fetchLectures(true),
  });

  const { data: exams } = useQuery({
    queryKey: ["results-exams", selectedLecture],
    queryFn: () => fetchExams({ lecture_id: selectedLecture! }),
    enabled: selectedLecture != null && tab === "list",
  });

  const { data: results } = useQuery({
    queryKey: ["results-detail", selectedExam],
    queryFn: () => fetchExamResults(selectedExam!),
    enabled: selectedExam != null && tab === "list",
  });

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>성적</SectionTitle>

      <TabBar<Tab>
        tabs={[
          { key: "list", label: "조회" },
          { key: "stats", label: "통계" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "stats" && <ResultsStatsTab />}

      {tab === "list" && (
        <>
      {/* 조회 탭 원본 시작 */}

      {/* Lecture selector */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {(lectures ?? []).map((l: any) => (
          <button
            key={l.id}
            onClick={() => { setSelectedLecture(l.id); setSelectedExam(null); }}
            className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full cursor-pointer"
            style={{
              border: selectedLecture === l.id ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
              background: selectedLecture === l.id ? "var(--tc-primary-bg)" : "var(--tc-surface)",
              color: selectedLecture === l.id ? "var(--tc-primary)" : "var(--tc-text-secondary)",
            }}
          >
            <LectureChip lectureName={l.title} color={l.color} chipLabel={l.chip_label ?? l.chipLabel} size={14} />
            {l.title}
          </button>
        ))}
      </div>

      {selectedLecture == null && (
        <EmptyState scope="panel" tone="empty" title="강의를 선택하세요" />
      )}

      {/* Exam selector */}
      {selectedLecture != null && exams && (
        exams.length > 0 ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
              {exams.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedExam(e.id)}
                  className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full cursor-pointer"
                  style={{
                    border: selectedExam === e.id ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
                    background: selectedExam === e.id ? "var(--tc-primary-bg)" : "var(--tc-surface)",
                    color: selectedExam === e.id ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                  }}
                >
                  {e.title}
                </button>
              ))}
            </div>

            {/* Results */}
            {selectedExam != null && results && (
              results.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {results.map((r: any) => (
                    <div key={r.id} className="flex justify-between items-center py-2.5 px-1 border-b last:border-b-0" style={{ borderColor: "var(--tc-border)" }}>
                      <span className="text-sm" style={{ color: "var(--tc-text)" }}>{r.student_name ?? r.enrollment_name ?? "이름 없음"}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>
                          {r.total_score ?? r.score ?? "-"}/{r.max_score ?? 100}
                        </span>
                        <AchievementBadge passed={r.is_pass} achievement={r.achievement} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState scope="panel" tone="empty" title="결과가 없습니다" />
              )
            )}

            {selectedExam == null && (
              <EmptyState scope="panel" tone="empty" title="시험을 선택하세요" />
            )}
          </>
        ) : (
          <EmptyState scope="panel" tone="empty" title="이 강의에 시험이 없습니다" />
        )
      )}
        </>
      )}
    </div>
  );
}
