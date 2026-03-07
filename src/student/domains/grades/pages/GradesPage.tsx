/**
 * 성적 — 시험·과제 결과 허브 (대형학원 SaaS)
 * 실제 기입된 시험 결과·과제 성적을 학생앱 디자인으로 표시.
 */
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { useMyGradesSummary } from "../hooks/useMyGradesSummary";
import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "../api/grades";
import { IconExam, IconChevronRight, IconClipboard } from "@/student/shared/ui/icons/Icons";

function formatScore(total: number, max: number): string {
  if (max <= 0) return `${total}점`;
  return `${total}/${max}점`;
}

export default function GradesPage() {
  const { data, isLoading, isError } = useMyGradesSummary();
  const exams = data?.exams ?? [];
  const homeworks = data?.homeworks ?? [];

  return (
    <StudentPageShell title="성적">
      {isLoading && (
        <div className="stu-muted" style={{ padding: "var(--stu-space-4) 0" }}>
          불러오는 중…
        </div>
      )}
      {isError && (
        <EmptyState title="성적을 불러올 수 없습니다." description="잠시 후 다시 시도해 주세요." />
      )}

      {!isLoading && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
          {/* 시험 결과 진입 + 기입된 시험 결과 목록 */}
          <section>
            <Link
              to="/student/exams"
              className="stu-panel stu-panel--pressable stu-panel--accent stu-panel--nav"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--stu-space-4)",
                marginBottom: "var(--stu-space-3)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "var(--stu-surface-soft)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <IconExam style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>시험 결과</div>
                <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                  응시한 시험의 채점 결과를 확인하세요
                </div>
              </div>
              <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)" }} />
            </Link>

            {exams.length === 0 ? (
              <div className="stu-section stu-section--nested">
                <EmptyState
                  compact
                  title="기입된 시험 결과가 없습니다."
                  description="시험 응시 후 채점이 완료되면 여기에 표시됩니다."
                />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {exams.map((e: MyExamGradeSummary) => (
                  <Link
                    key={e.exam_id}
                    to={`/student/exams/${e.exam_id}/result`}
                    className="stu-panel stu-panel--pressable stu-panel--accent"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--stu-space-4)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "var(--stu-surface-soft)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <IconExam style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                      <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                        {e.lecture_title && `${e.lecture_title} · `}
                        {formatScore(e.total_score, e.max_score)}
                        {e.is_pass ? " · 합격" : " · 불합격"}
                      </div>
                    </div>
                    <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)" }} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 과제 이력 */}
          <section>
            <div
              className="stu-muted"
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: "var(--stu-space-2)",
              }}
            >
              과제 이력
            </div>
            {homeworks.length === 0 ? (
              <div className="stu-section stu-section--nested">
                <EmptyState
                  compact
                  title="기입된 과제 성적이 없습니다."
                  description="과제 점수가 입력되면 여기에 표시됩니다."
                />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
                {homeworks.map((h: MyHomeworkGradeSummary, idx: number) => (
                  <div
                    key={`${h.homework_id}-${h.lecture_title ?? ""}-${idx}`}
                    className="stu-panel stu-panel--accent"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--stu-space-4)",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "var(--stu-surface-soft)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <IconClipboard style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.title}</div>
                      <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                        {h.lecture_title && `${h.lecture_title} · `}
                        {h.max_score != null
                          ? `${h.score}/${h.max_score}점`
                          : `${h.score}점`}
                        {h.passed ? " · 합격" : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </StudentPageShell>
  );
}
