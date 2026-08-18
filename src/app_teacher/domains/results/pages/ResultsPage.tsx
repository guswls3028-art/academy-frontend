// PATH: src/app_teacher/domains/results/pages/ResultsPage.tsx
// 성적 — 조회 + 통계 탭
import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge, EmptyState } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { SectionTitle, TabBar } from "@teacher/shared/ui/Card";
import { AchievementBadge } from "@teacher/shared/ui/Badge";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { fetchLectures } from "@teacher/domains/lectures/api";
import { fetchExams } from "@teacher/domains/exams/api";
// 사이드바 성적은 admin endpoint schema(enrollment_id) 사용 — statsApi SSOT
import { fetchExamResults } from "@teacher/domains/results/statsApi";
import {
  getExamResultEnrollmentId,
  getExamResultMaxScore,
  getExamResultScore,
} from "@teacher/domains/results/examResultContract";
import type { TeacherExamResultRow } from "@teacher/domains/scores/api";
import EnterpriseAnalyticsTab from "@teacher/domains/results/components/EnterpriseAnalyticsTab";
import ResultsStatsTab from "@teacher/domains/results/components/ResultsStatsTab";
import { teacherResultsQueryKeys } from "@teacher/domains/results/queryKeys";
import styles from "./ResultsPage.module.css";

type Tab = "list" | "stats" | "analytics";

type TeacherExamOption = {
  id: number;
  title: string;
};

export default function ResultsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("list");
  const [selectedLecture, setSelectedLecture] = useState<number | null>(null);
  const [selectedExam, setSelectedExam] = useState<number | null>(null);

  const { data: lectures } = useQuery({
    queryKey: teacherResultsQueryKeys.activeLectures,
    queryFn: () => fetchLectures(true),
  });

  const { data: exams } = useQuery({
    queryKey: teacherResultsQueryKeys.examsForLecture(selectedLecture),
    queryFn: async (): Promise<TeacherExamOption[]> => fetchExams({ lecture_id: selectedLecture! }),
    enabled: selectedLecture != null && tab === "list",
  });

  const { data: results } = useQuery({
    queryKey: teacherResultsQueryKeys.detail(selectedExam),
    queryFn: async (): Promise<TeacherExamResultRow[]> => fetchExamResults(selectedExam!),
    enabled: selectedExam != null && tab === "list",
  });
  const selectedLectureObj = (lectures ?? []).find((lecture) => lecture.id === selectedLecture);

  return (
    <div className={styles.page}>
      <SectionTitle>성적</SectionTitle>

      <TabBar<Tab>
        tabs={[
          { key: "list", label: "조회" },
          { key: "stats", label: "통계" },
          { key: "analytics", label: "운영 분석" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "stats" && <ResultsStatsTab />}
      {tab === "analytics" && <EnterpriseAnalyticsTab />}

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
            <EmptyState
              scope="panel"
              tone="empty"
              title="강의를 선택하세요"
              description="강의를 선택하면 연결된 시험과 학생별 성적을 바로 볼 수 있습니다."
              actions={(lectures?.length ?? 0) > 0 ? (
                <EmptyActionButton onClick={() => setSelectedLecture(lectures![0].id)}>
                  첫 강의 선택
                </EmptyActionButton>
              ) : (
                <EmptyActionButton onClick={() => navigate("/workspace/mobile/classes")}>
                  강의 확인
                </EmptyActionButton>
              )}
            />
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
                      {results.map((result, index) => {
                        const enrollmentId = getExamResultEnrollmentId(result);
                        const score = getExamResultScore(result);
                        const max = getExamResultMaxScore(result);
                        const correction = result.correction_status === "PENDING"
                          ? { label: "오답 미완료", tone: "warning" as const }
                          : result.correction_status === "COMPLETED"
                            ? { label: "오답 완료", tone: "success" as const }
                            : result.correction_status === "NOT_REQUIRED"
                              ? { label: "오답 없음", tone: "neutral" as const }
                              : null;
                        return (
                          <div key={enrollmentId ?? result.id ?? `result-${index}`} className={styles.resultRow}>
                            <StudentNameWithLectureChip
                              name={result.student_name ?? "이름 없음"}
                              lectures={
                                selectedLectureObj
                                  ? [{
                                      lectureName: selectedLectureObj.title,
                                      color: selectedLectureObj.color,
                                      chipLabel: selectedLectureObj.chip_label ?? selectedLectureObj.chipLabel,
                                    }]
                                  : undefined
                              }
                              chipSize={18}
                              className={styles.studentName}
                            />
                            <div className={styles.scoreGroup}>
                              <span className={styles.scoreText}>
                                {score != null ? `${score}/${max}` : "-"}
                              </span>
                              <AchievementBadge passed={result.final_pass ?? result.passed} achievement={result.achievement} />
                              {correction && (
                                <Badge size="xs" tone={correction.tone}>{correction.label}</Badge>
                              )}
                              {result.correction_session_id != null
                                && result.correction_status !== "NOT_REQUIRED"
                                && selectedExam != null && (
                                <button
                                  type="button"
                                  className={styles.correctionLink}
                                  onClick={() => navigate(`/workspace/mobile/scores/${result.correction_session_id}?exam=${selectedExam}`)}
                                  aria-label={`${result.student_name ?? "학생"} 오답 상태 수정`}
                                >
                                  수정
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      scope="panel"
                      tone="empty"
                      title="결과가 없습니다"
                      description="성적 입력이 끝나면 학생별 점수와 성취도가 이곳에 표시됩니다."
                      actions={
                        <EmptyActionButton onClick={() => selectedLecture != null && navigate(`/workspace/mobile/classes/${selectedLecture}`)}>
                          강의로 이동
                        </EmptyActionButton>
                      }
                    />
                  )
                )}

                {selectedExam == null && (
                  <EmptyState
                    scope="panel"
                    tone="empty"
                    title="시험을 선택하세요"
                    description="조회할 시험을 고르면 학생별 결과가 표시됩니다."
                  />
                )}
              </>
            ) : (
              <EmptyState
                scope="panel"
                tone="empty"
                title="이 강의에 시험이 없습니다"
                description="차시에 시험을 추가하면 성적 조회와 통계가 연결됩니다."
                actions={
                  <EmptyActionButton onClick={() => navigate(`/workspace/mobile/classes/${selectedLecture}`)}>
                    차시 확인
                  </EmptyActionButton>
                }
              />
            )
          )}
        </>
      )}
    </div>
  );
}
