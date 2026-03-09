// PATH: src/features/sessions/components/SessionAssessmentSidePanel.tsx
import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";
import { fetchAdminSessionExams } from "@/features/results/api/adminSessionExams";
import type { SessionExamRow } from "@/features/results/api/adminSessionExams";
import { updateAdminExam, saveExamAsTemplate } from "@/features/exams/api/adminExam";
import { updateAdminHomework } from "@/features/homework/api/adminHomework";

import { feedback } from "@/shared/ui/feedback/feedback";
import CreateRegularExamModal from "@/features/exams/components/create/CreateRegularExamModal";
import CreateHomeworkModal from "@/features/homework/components/CreateHomeworkModal";

type Props = {
  lectureId: number;
  sessionId: number;
  openCreateExam?: boolean;
  onCloseCreateExam?: () => void;
  onOpenCreateExam?: () => void;
  openCreateHomework?: boolean;
  onCloseCreateHomework?: () => void;
  onOpenCreateHomework?: () => void;
};

type HomeworkItem = {
  id: number;
  title: string;
  status?: "DRAFT" | "OPEN" | "CLOSED";
};

export default function SessionAssessmentSidePanel({
  lectureId,
  sessionId,
  openCreateExam: openCreateExamProp,
  onCloseCreateExam,
  onOpenCreateExam,
  openCreateHomework: openCreateHomeworkProp,
  onCloseCreateHomework,
  onOpenCreateHomework: onOpenCreateHomeworkProp,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [openCreateExamLocal, setOpenCreateExamLocal] = useState(false);
  const openCreateExam = openCreateExamProp ?? openCreateExamLocal;
  const setOpenCreateExam = onOpenCreateExam ?? (() => setOpenCreateExamLocal(true));
  const handleCloseCreateExam = onCloseCreateExam ?? (() => setOpenCreateExamLocal(false));

  const [openCreateHomeworkLocal, setOpenCreateHomeworkLocal] = useState(false);
  const openCreateHomework = openCreateHomeworkProp ?? openCreateHomeworkLocal;
  const setOpenCreateHomework = onOpenCreateHomeworkProp ?? (() => setOpenCreateHomeworkLocal(true));
  const handleCloseCreateHomework = onCloseCreateHomework ?? (() => setOpenCreateHomeworkLocal(false));

  const examId = useMemo(() => {
    const v = Number(searchParams.get("examId"));
    return Number.isFinite(v) ? v : null;
  }, [searchParams]);

  const homeworkId = useMemo(() => {
    const v = Number(searchParams.get("homeworkId"));
    return Number.isFinite(v) ? v : null;
  }, [searchParams]);

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["admin-session-exams", sessionId],
    queryFn: () => fetchAdminSessionExams(sessionId),
    enabled: !!sessionId,
  });

  const { data: examsSummary } = useQuery({
    queryKey: ["session-exams-summary", sessionId],
    queryFn: async () => {
      const res = await api.get(`/results/admin/sessions/${sessionId}/exams/summary/`);
      return res.data as { exams?: { exam_id: number; participant_count: number; pass_count: number; fail_count: number }[] };
    },
    enabled: !!sessionId,
  });

  const examStatsById = useMemo(() => {
    const map: Record<number, { participant_count: number; pass_count: number; fail_count: number }> = {};
    (examsSummary?.exams ?? []).forEach((e) => {
      map[e.exam_id] = { participant_count: e.participant_count, pass_count: e.pass_count, fail_count: e.fail_count };
    });
    return map;
  }, [examsSummary]);

  const { data: homeworks = [], isLoading: hwLoading } = useQuery({
    queryKey: ["session-homeworks", sessionId],
    queryFn: async (): Promise<HomeworkItem[]> => {
      const res = await api.get("/homeworks/", { params: { session_id: sessionId } });
      const arr = res.data?.results ?? res.data?.items ?? res.data ?? [];
      return arr.map((x: any) => ({
        id: Number(x.id),
        title: String(x.title ?? ""),
        status: (x.status ?? "DRAFT") as HomeworkItem["status"],
      }));
    },
    enabled: !!sessionId,
  });

  const base = `/admin/lectures/${lectureId}/sessions/${sessionId}`;

  // 시험 탭 진입 시 선택 없으면 최상단 시험 자동 선택 / 과제 탭 진입 시 최상단 과제 자동 선택
  useEffect(() => {
    if (!sessionId || !lectureId) return;
    const path = location.pathname;
    const basePath = `/admin/lectures/${lectureId}/sessions/${sessionId}`;
    if (path.startsWith(`${basePath}/exams`)) {
      if (examId == null && exams.length > 0) {
        const firstId = Number((exams[0] as SessionExamRow).exam_id);
        if (Number.isFinite(firstId)) {
          navigate({ pathname: `${basePath}/exams`, search: `?examId=${firstId}` }, { replace: true });
        }
      }
    } else if (path.startsWith(`${basePath}/assignments`)) {
      if (homeworkId == null && homeworks.length > 0) {
        const firstId = homeworks[0].id;
        if (Number.isFinite(firstId)) {
          navigate({ pathname: `${basePath}/assignments`, search: `?homeworkId=${firstId}` }, { replace: true });
        }
      }
    }
  }, [location.pathname, sessionId, lectureId, examId, homeworkId, exams, homeworks, navigate]);

  const invalidateExams = () => qc.invalidateQueries({ queryKey: ["admin-session-exams", sessionId] });
  const invalidateSessionScores = () => qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
  const invalidateHomeworks = () => qc.invalidateQueries({ queryKey: ["session-homeworks", sessionId] });
  const invalidateAdminExam = (id: number) => qc.invalidateQueries({ queryKey: ["admin-exam", id] });

  const onSelectExam = (id: number) => {
    navigate({ pathname: `${base}/exams`, search: `?examId=${id}` });
  };

  const onSelectHomework = (id: number) => {
    navigate({ pathname: `${base}/assignments`, search: `?homeworkId=${id}` });
  };

  const handleExamProgress = async (row: SessionExamRow) => {
    const id = Number(row.exam_id);
    try {
      try {
        await saveExamAsTemplate(id);
        invalidateExams();
      } catch (_) {
        // 이미 템플릿이 있으면 무시
      }
      await updateAdminExam(id, { status: "OPEN" });
      invalidateExams();
      invalidateAdminExam(id);
      feedback.success("시험을 진행 중으로 변경했습니다.");
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "변경 실패");
    }
  };

  const handleExamClose = async (row: SessionExamRow) => {
    try {
      await updateAdminExam(Number(row.exam_id), { status: "CLOSED" });
      invalidateExams();
      invalidateAdminExam(Number(row.exam_id));
      feedback.success("시험을 마감했습니다.");
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "변경 실패");
    }
  };

  const handleHomeworkProgress = async (hw: HomeworkItem) => {
    try {
      await updateAdminHomework(hw.id, { status: "OPEN" });
      invalidateHomeworks();
      invalidateSessionScores();
      feedback.success("과제를 진행 중으로 변경했습니다.");
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "변경 실패");
    }
  };

  const handleHomeworkClose = async (hw: HomeworkItem) => {
    try {
      await updateAdminHomework(hw.id, { status: "CLOSED" });
      invalidateHomeworks();
      invalidateSessionScores();
      feedback.success("과제를 마감했습니다.");
    } catch (e: any) {
      feedback.error(e?.response?.data?.detail ?? "변경 실패");
    }
  };

  return (
    <aside
      className="flex-shrink-0 self-start overflow-y-auto sticky"
      style={{
        width: 280,
        maxHeight: "calc(100vh - 140px)",
        top: "var(--space-6)",
      }}
    >
      <div className="grid gap-5">
        <section
          className="rounded-2xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4 shadow-sm"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
              시험
            </h3>
            <Button type="button" intent="ghost" size="sm" onClick={setOpenCreateExam} className="text-xs font-semibold">
              + 추가
            </Button>
          </div>
          <div className="grid gap-1.5">
            {examsLoading && <Empty>불러오는 중…</Empty>}
            {!examsLoading && exams.length === 0 && <Empty>시험 없음</Empty>}
            {exams.map((exam: SessionExamRow) => {
              const active = examId != null && Number(exam.exam_id) === examId;
              const stats = examStatsById[Number(exam.exam_id)];
              const statusLine = stats
                ? `채점 ${stats.participant_count} / 합격 ${stats.pass_count} / 불합 ${stats.fail_count}`
                : "";
              return (
                <ExamItemRow
                  key={exam.exam_id}
                  active={active}
                  label={exam.title}
                  sub={statusLine}
                  status={exam.status}
                  onSelect={() => onSelectExam(Number(exam.exam_id))}
                  onStart={(e) => { e.stopPropagation(); handleExamProgress(exam); }}
                  onEnd={(e) => { e.stopPropagation(); handleExamClose(exam); }}
                />
              );
            })}
          </div>
        </section>

        <section
          className="rounded-2xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4 shadow-sm"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
              과제
            </h3>
            <Button type="button" intent="ghost" size="sm" onClick={setOpenCreateHomework} className="text-xs font-semibold">
              + 추가
            </Button>
          </div>
          <div className="grid gap-1.5">
            {hwLoading && <Empty>불러오는 중…</Empty>}
            {!hwLoading && homeworks.length === 0 && <Empty>과제 없음</Empty>}
            {homeworks.map((hw) => {
              const active = homeworkId === hw.id;
              const sub = hw.status ? `상태: ${hw.status}` : "";
              return (
                <HomeworkItemRow
                  key={hw.id}
                  active={active}
                  label={hw.title}
                  sub={sub}
                  status={hw.status ?? "DRAFT"}
                  onSelect={() => onSelectHomework(hw.id)}
                  onStart={(e) => { e.stopPropagation(); handleHomeworkProgress(hw); }}
                  onEnd={(e) => { e.stopPropagation(); handleHomeworkClose(hw); }}
                />
              );
            })}
          </div>
        </section>
      </div>

      <CreateRegularExamModal
        open={openCreateExam}
        onClose={handleCloseCreateExam}
        sessionId={sessionId}
        lectureId={lectureId}
        onCreated={(id) => {
          invalidateExams();
          invalidateSessionScores();
          feedback.success("시험이 생성되었습니다.");
          onSelectExam(id);
        }}
      />
      <CreateHomeworkModal
        open={openCreateHomework}
        onClose={handleCloseCreateHomework}
        sessionId={sessionId}
        onCreated={(id) => {
          invalidateHomeworks();
          invalidateSessionScores();
          onSelectHomework(id);
        }}
      />
    </aside>
  );
}

function ExamItemRow({
  active,
  label,
  sub,
  status,
  onSelect,
  onStart,
  onEnd,
}: {
  active: boolean;
  label: string;
  sub: string;
  status: SessionExamRow["status"];
  onSelect: () => void;
  onStart: (e: React.MouseEvent) => void;
  onEnd: (e: React.MouseEvent) => void;
}) {
  const isDraft = status === "DRAFT";
  const isOpen = status === "OPEN";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`
        group rounded-xl border-l-4 px-3 py-2.5 text-left transition-all
        ${active
          ? "border-l-[var(--color-primary)] bg-[var(--state-selected-bg)] ring-1 ring-[var(--color-primary)]/20"
          : "border-l-transparent hover:bg-[var(--color-bg-surface-soft)]"
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{label}</div>
          {sub && <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {isDraft && (
            <Button type="button" size="sm" intent="primary" onClick={onStart} className="!py-1 !text-xs">
              진행
            </Button>
          )}
          {isOpen && (
            <Button type="button" size="sm" intent="secondary" onClick={onEnd} className="!py-1 !text-xs">
              마감
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeworkItemRow({
  active,
  label,
  sub,
  status,
  onSelect,
  onStart,
  onEnd,
}: {
  active: boolean;
  label: string;
  sub: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  onSelect: () => void;
  onStart: (e: React.MouseEvent) => void;
  onEnd: (e: React.MouseEvent) => void;
}) {
  const isDraft = status === "DRAFT";
  const isOpen = status === "OPEN";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`
        group rounded-xl border-l-4 px-3 py-2.5 text-left transition-all
        ${active
          ? "border-l-[var(--color-primary)] bg-[var(--state-selected-bg)] ring-1 ring-[var(--color-primary)]/20"
          : "border-l-transparent hover:bg-[var(--color-bg-surface-soft)]"
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{label}</div>
          {sub && <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {isDraft && (
            <Button type="button" size="sm" intent="primary" onClick={onStart} className="!py-1 !text-xs">
              진행
            </Button>
          )}
          {isOpen && (
            <Button type="button" size="sm" intent="secondary" onClick={onEnd} className="!py-1 !text-xs">
              마감
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--color-bg-surface-soft)] px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}
