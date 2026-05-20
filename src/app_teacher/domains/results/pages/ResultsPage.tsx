// PATH: src/app_teacher/domains/results/pages/ResultsPage.tsx
// 성적 — 조회 + 통계 탭
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { SectionTitle, TabBar } from "@teacher/shared/ui/Card";
import { AchievementBadge } from "@teacher/shared/ui/Badge";
import { fetchLectures } from "@teacher/domains/lectures/api";
import { fetchExams } from "@teacher/domains/exams/api";
// 사이드바 성적은 admin endpoint schema(enrollment_id) 사용 — statsApi SSOT
import { fetchExamResults } from "@teacher/domains/results/statsApi";
import ResultsStatsTab from "@teacher/domains/results/components/ResultsStatsTab";
import styles from "./ResultsPage.module.css";

type Tab = "list" | "stats";

type TeacherExamOption = {
  id: number;
  title: string;
};

type ResultRow = {
  enrollment_id: number | string;
  student_name?: string | null;
  final_score?: number | string | null;
  exam_score?: number | string | null;
  exam_max_score?: number | string | null;
  max_score?: number | string | null;
  final_pass?: boolean | null;
  passed?: boolean | null;
  achievement?: string | null;
};

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
    queryFn: async (): Promise<TeacherExamOption[]> => fetchExams({ lecture_id: selectedLecture! }),
    enabled: selectedLecture != null && tab === "list",
  });

  const { data: results } = useQuery({
    queryKey: ["results-detail", selectedExam],
    queryFn: async (): Promise<ResultRow[]> => fetchExamResults(selectedExam!),
    enabled: selectedExam != null && tab === "list",
  });

  return (
    <div className={styles.page}>
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
          <div className={styles.selectorScroller}>
            {(lectures ?? []).map((lecture) => {
              const isSelected = selectedLecture === lecture.id;
              return (
                <button
                  key={lecture.id}
                  onClick={() => { setSelectedLecture(lecture.id); setSelectedExam(null); }}
                  className={`${styles.lectureChipButton} ${isSelected ? styles.selectedChipButton : ""}`}
                  type="button"
                >
                  <LectureChip
                    lectureName={lecture.title}
                    color={lecture.color ?? undefined}
                    chipLabel={lecture.chip_label ?? lecture.chipLabel}
                    size={20}
                  />
                  {lecture.title}
                </button>
              );
            })}
          </div>

          {selectedLecture == null && (
            <EmptyState scope="panel" tone="empty" title="강의를 선택하세요" />
          )}

          {selectedLecture != null && exams && (
            exams.length > 0 ? (
              <>
                <div className={styles.selectorScroller}>
                  {exams.map((exam) => {
                    const isSelected = selectedExam === exam.id;
                    return (
                      <button
                        key={exam.id}
                        onClick={() => setSelectedExam(exam.id)}
                        className={`${styles.examChipButton} ${isSelected ? styles.selectedChipButton : ""}`}
                        type="button"
                      >
                        {exam.title}
                      </button>
                    );
                  })}
                </div>

                {selectedExam != null && results && (
                  results.length > 0 ? (
                    <div className={styles.resultList}>
                      {results.map((result) => {
                        const score = result.final_score ?? result.exam_score;
                        const max = result.exam_max_score ?? result.max_score ?? 100;
                        return (
                          <div key={result.enrollment_id} className={styles.resultRow}>
                            <span className={styles.studentName}>{result.student_name ?? "이름 없음"}</span>
                            <div className={styles.scoreGroup}>
                              <span className={styles.scoreText}>
                                {score != null ? `${score}/${max}` : "-"}
                              </span>
                              <AchievementBadge passed={result.final_pass ?? result.passed} achievement={result.achievement} />
                            </div>
                          </div>
                        );
                      })}
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
