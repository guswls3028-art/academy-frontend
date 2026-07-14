// PATH: src/app_teacher/domains/exams/pages/HomeworkDetailPage.tsx
// 과제 상세 — 제출 현황
import type { ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { fetchHomework, fetchHomeworkSubmissions } from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import {
  normalizeHomework,
  normalizeHomeworkSubmissions,
  type HomeworkSubmission,
} from "../normalizers";
import { teacherExamsQueryKeys } from "../queryKeys";
import styles from "./HomeworkDetailPage.module.css";

function isSubmittedSubmission(submission: HomeworkSubmission): boolean {
  return submission.submitted_at != null || submission.status === "submitted";
}

function formatDate(date: string | null): string {
  if (!date) return "제출";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("ko-KR");
}

export default function HomeworkDetailPage() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const navigate = useNavigate();
  const hid = Number(homeworkId);

  const { data: hw, isLoading: loadingHw } = useQuery({
    queryKey: teacherExamsQueryKeys.homework(hid),
    queryFn: async () => normalizeHomework(await fetchHomework(hid)),
    enabled: Number.isFinite(hid),
  });

  const { data: submissions, isLoading: loadingSub } = useQuery({
    queryKey: teacherExamsQueryKeys.homeworkSubmissions(hid),
    queryFn: async () => normalizeHomeworkSubmissions(await fetchHomeworkSubmissions(hid)),
    enabled: Number.isFinite(hid),
  });

  if (loadingHw || loadingSub)
    return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!hw)
    return <EmptyState scope="panel" tone="error" title="과제를 찾을 수 없습니다" />;

  const dueDate = hw.due_date;
  const maxScore = hw.max_score;
  const submissionRows = submissions ?? [];
  const submitted = submissionRows.filter(isSubmittedSubmission);
  const pending = submissionRows.filter((s) => !isSubmittedSubmission(s));

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackBtn onClick={() => navigate(-1)} />
        <h1 className={`${styles.title} text-[17px] font-bold flex-1 truncate`}>
          {hw.title}
        </h1>
      </div>

      {/* Info */}
      <div className={`${styles.panel} rounded-xl flex flex-col gap-2`}>
        {hw.session_title && (
          <div className="flex justify-between text-sm">
            <span className={styles.mutedText}>수업</span>
            <span className={styles.title}>{hw.session_title}</span>
          </div>
        )}
        {dueDate && (
          <div className="flex justify-between text-sm">
            <span className={styles.mutedText}>마감일</span>
            <span className={styles.title}>{dueDate}</span>
          </div>
        )}
        {maxScore != null && (
          <div className="flex justify-between text-sm">
            <span className={styles.mutedText}>만점</span>
            <span className={styles.title}>{maxScore}점</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className={styles.mutedText}>제출</span>
          <span className={styles.primaryText}>
            {submitted.length} / {submissionRows.length}
          </span>
        </div>
      </div>

      {/* Submitted */}
      {submitted.length > 0 && (
        <Section title={`제출 완료 (${submitted.length})`}>
          {submitted.map((s) => (
            <div key={s.id} className={`${styles.row} flex justify-between items-center py-2`}>
              <span className={`${styles.title} text-sm`}>
                {s.student_name}
              </span>
              <span className={`${styles.successText} text-xs font-semibold`}>
                {formatDate(s.submitted_at)}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <PendingSection
          pending={pending}
          homeworkTitle={hw.title}
          dueDate={dueDate ?? undefined}
          onCopy={async (text) => {
            try {
              await navigator.clipboard.writeText(text);
              teacherToast.success(`미제출 ${pending.length}명 명단이 복사되었습니다.`);
            } catch {
              teacherToast.error("복사에 실패했습니다.");
            }
          }}
          onOpenStudent={(s) => {
            if (s.student_id != null && s.student_id > 0) {
              navigate(`/teacher/students/${s.student_id}`);
            } else {
              teacherToast.error("학생 상세 정보를 찾을 수 없습니다.");
            }
          }}
        />
      )}

      {submissionRows.length === 0 && (
        <EmptyState
          scope="panel"
          tone="empty"
          title="제출 현황이 없습니다"
          description="수강생이 과제를 제출하면 제출·미제출 현황이 자동으로 정리됩니다."
          actions={
            <EmptyActionButton variant="secondary" onClick={() => navigate(-1)}>
              차시로 돌아가기
            </EmptyActionButton>
          }
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${styles.panel} rounded-xl`}>
      <h3 className={`${styles.title} text-sm font-bold mb-3`}>{title}</h3>
      <div className="flex flex-col gap-0">{children}</div>
    </div>
  );
}

function PendingSection({
  pending,
  homeworkTitle,
  dueDate,
  onCopy,
  onOpenStudent,
}: {
  pending: HomeworkSubmission[];
  homeworkTitle: string;
  dueDate?: string;
  onCopy: (text: string) => Promise<void> | void;
  onOpenStudent: (s: HomeworkSubmission) => void;
}) {
  const handleCopyAll = () => {
    const lines = pending.map((s) => {
      const name = s.student_name;
      const phone = s.student_phone ?? s.parent_phone ?? "";
      return phone ? `${name} (${phone})` : name;
    });
    const header = `[${homeworkTitle}] 미제출 ${pending.length}명${dueDate ? ` · 마감 ${dueDate}` : ""}`;
    onCopy([header, ...lines].join("\n"));
  };

  return (
    <div className={`${styles.panel} rounded-xl`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`${styles.title} text-sm font-bold`}>
          미제출 ({pending.length})
        </h3>
        <button
          type="button"
          onClick={handleCopyAll}
          className={`${styles.copyButton} text-[12px] font-semibold cursor-pointer`}
        >
          명단 복사
        </button>
      </div>
      <div className="flex flex-col gap-0">
        {pending.map((s) => {
          return (
            <div
              key={s.id}
              className={`${styles.row} flex justify-between items-center py-2`}
            >
              <span className={`${styles.title} text-sm`}>
                {s.student_name}
              </span>
              <div className="flex items-center gap-2">
                <span className={`${styles.dangerText} text-xs font-semibold`}>미제출</span>
                <button
                  type="button"
                  onClick={() => onOpenStudent(s)}
                  className={`${styles.contactButton} ${styles.contactButtonDetail} text-[11px] font-semibold cursor-pointer`}
                  title="학생 상세로 이동"
                >
                  상세
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.backButton} flex p-1 cursor-pointer`}
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
