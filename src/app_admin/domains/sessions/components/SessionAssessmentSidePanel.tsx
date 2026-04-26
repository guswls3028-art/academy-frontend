// PATH: src/app_admin/domains/sessions/components/SessionAssessmentSidePanel.tsx
import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { Button, Badge } from "@/shared/ui/ds";
import { fetchAdminSessionExams } from "@admin/domains/results/api/adminSessionExams";
import type { SessionExamRow } from "@admin/domains/results/api/adminSessionExams";
import { updateAdminExam } from "@admin/domains/exams/api/adminExam";
import { updateAdminHomework } from "@admin/domains/homework/api/adminHomework";
import { fetchHomeworkPolicyBySession } from "@admin/domains/homework/api/homeworkPolicy";

import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import CreateRegularExamModal from "@admin/domains/exams/components/create/CreateRegularExamModal";
import CreateHomeworkModal from "@admin/domains/homework/components/CreateHomeworkModal";
import ApplyBundleModal from "@admin/domains/exams/components/create/ApplyBundleModal";

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

function getErrorDetail(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as { response?: { data?: { detail?: unknown } } }).response;
    if (typeof maybeResponse?.data?.detail === "string") return maybeResponse.data.detail;
  }
  return "변경 실패";
}

/* ------------------------------------------------------------------ */
/*  Inline styles (CSS-in-JS) — uses design tokens only               */
/* ------------------------------------------------------------------ */

const S = {
  aside: {
    width: 296,
    maxHeight: "calc(100vh - 140px)",
    top: "var(--space-6)",
    flexShrink: 0,
    alignSelf: "start",
    overflowY: "auto",
    position: "sticky",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-5)",
  } satisfies CSSProperties,

  section: {
    borderRadius: "var(--radius-lg, 12px)",
    border: "1px solid var(--color-border-divider)",
    background: "var(--color-bg-surface)",
    boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.02)",
    overflow: "hidden",
  } satisfies CSSProperties,

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px 8px",
  } satisfies CSSProperties,

  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "var(--color-text-muted)",
  } satisfies CSSProperties,

  countBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1,
    borderRadius: "var(--radius-full, 9999px)",
    background: "color-mix(in srgb, var(--color-border-divider) 18%, var(--color-bg-surface))",
    color: "var(--color-text-muted)",
  } satisfies CSSProperties,

  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "0 6px 8px",
    overflowY: "auto",
    maxHeight: 320,
  } satisfies CSSProperties,

  /* Card base — shared between exam & homework rows */
  card: (active: boolean, status?: "DRAFT" | "OPEN" | "CLOSED"): CSSProperties => ({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "10px 12px 10px 12px",
    borderRadius: "var(--radius-md, 8px)",
    cursor: "pointer",
    transition: "background 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
    background: active
      ? "var(--state-selected-bg)"
      : "var(--color-bg-surface)",
    boxShadow: active
      ? "inset 0 0 0 1.5px color-mix(in srgb, var(--color-brand-primary) 35%, transparent)"
      : "none",
    border: "1px solid var(--color-border-divider)",
    opacity: status === "CLOSED" ? 0.78 : 1,
  }),

  cardTopRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    minWidth: 0,
  } satisfies CSSProperties,

  cardTitle: {
    flex: 1,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.35,
    color: "var(--color-text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  cardMeta: {
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    lineHeight: 1,
    paddingLeft: 2,
  } satisfies CSSProperties,

  /* Action buttons row — always visible, inline */
  actionsRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-1)",
    marginTop: 4,
  } satisfies CSSProperties,

  emptyState: {
    padding: "20px 14px",
    textAlign: "center",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    lineHeight: 1.5,
  } satisfies CSSProperties,
} as const;

/* ------------------------------------------------------------------ */
/*  Status badge helper                                                */
/* ------------------------------------------------------------------ */

type StatusTone = "success" | "danger" | "neutral" | "primary";

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <Badge
      variant="solid"
      tone={tone}
      size="sm"
      style={{ flexShrink: 0 }}
    >
      {label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

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
  const confirm = useConfirm();
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

  const [openApplyBundle, setOpenApplyBundle] = useState(false);
  const [examBusy, setExamBusy] = useState<{ id: number; action: "start" | "end" } | null>(null);
  const [hwBusy, setHwBusy] = useState<{ id: number; action: "start" | "end" } | null>(null);

  const examId = useMemo(() => {
    const v = Number(searchParams.get("examId"));
    return Number.isFinite(v) ? v : null;
  }, [searchParams]);

  const homeworkId = useMemo(() => {
    const v = Number(searchParams.get("homeworkId"));
    return Number.isFinite(v) ? v : null;
  }, [searchParams]);

  const { data: exams = [], isLoading: examsLoading, isError: examsError } = useQuery({
    queryKey: ["admin-session-exams", sessionId],
    queryFn: () => fetchAdminSessionExams(sessionId),
    enabled: !!sessionId,
  });

  const { data: examsSummary } = useQuery({
    queryKey: ["session-exams-summary", sessionId],
    queryFn: async () => {
      const res = await api.get(`/results/admin/sessions/${sessionId}/exams/summary/`);
      return res.data as { exams?: { exam_id: number; max_score: number }[] };
    },
    enabled: !!sessionId,
  });

  const examMaxScoreById = useMemo(() => {
    const map: Record<number, number> = {};
    (examsSummary?.exams ?? []).forEach((e) => {
      const ms = Number(e.max_score);
      map[e.exam_id] = Number.isFinite(ms) && ms > 0 ? ms : 100;
    });
    return map;
  }, [examsSummary]);

  // 채점 완료 학생 수 (latest Result 기준)
  const examGradedCountById = useMemo(() => {
    const map: Record<number, number> = {};
    (examsSummary?.exams ?? []).forEach((e) => {
      const c = Number((e as { participant_count?: number }).participant_count);
      map[e.exam_id] = Number.isFinite(c) && c >= 0 ? c : 0;
    });
    return map;
  }, [examsSummary]);

  const { data: homeworkPolicy } = useQuery({
    queryKey: ["homework-policy", sessionId],
    queryFn: () => fetchHomeworkPolicyBySession(sessionId),
    enabled: !!sessionId,
  });

  const { data: homeworks = [], isLoading: hwLoading, isError: hwError } = useQuery({
    queryKey: ["session-homeworks", sessionId],
    queryFn: async (): Promise<HomeworkItem[]> => {
      const res = await api.get("/homeworks/", { params: { session_id: sessionId } });
      const arr = res.data?.results ?? res.data?.items ?? res.data ?? [];
      const list = Array.isArray(arr) ? arr : [];
      return list.map((x: { id?: unknown; title?: unknown; status?: unknown }) => ({
        id: Number(x.id),
        title: String(x.title ?? ""),
        status: (x.status ?? "OPEN") as HomeworkItem["status"],
      }));
    },
    enabled: !!sessionId,
  });

  const base = `/admin/lectures/${lectureId}/sessions/${sessionId}`;

  // Auto-select first exam/homework when entering tab with no selection
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

  // 자동 마감은 백엔드 일일 cron(close_overdue_assessments)이 처리한다.
  // 사이드패널 마운트에 의존하던 기존 useEffect는 운영 신뢰성 문제로 제거.

  const invalidateExams = () => qc.invalidateQueries({ queryKey: ["admin-session-exams", sessionId] });
  const invalidateExamsSummary = () => qc.invalidateQueries({ queryKey: ["session-exams-summary", sessionId] });
  const invalidateSessionScores = () => qc.invalidateQueries({ queryKey: ["session-scores", sessionId] });
  const invalidateHomeworks = () => qc.invalidateQueries({ queryKey: ["session-homeworks", sessionId] });

  const onSelectExam = (examId: number) => {
    navigate({ pathname: `${base}/exams`, search: `?examId=${examId}` });
  };

  const onSelectHomework = (homeworkId: number) => {
    navigate({ pathname: `${base}/assignments`, search: `?homeworkId=${homeworkId}` });
  };

  const handleHomeworkProgress = async (hw: HomeworkItem) => {
    if (hwBusy) return;
    setHwBusy({ id: hw.id, action: "start" });
    try {
      await updateAdminHomework(hw.id, { status: "OPEN" });
      invalidateHomeworks();
      invalidateSessionScores();
      feedback.success("과제를 진행 중으로 변경했습니다.");
    } catch (e: unknown) {
      feedback.error(getErrorDetail(e));
    } finally {
      setHwBusy(null);
    }
  };

  const handleHomeworkClose = async (hw: HomeworkItem) => {
    if (hwBusy) return;
    setHwBusy({ id: hw.id, action: "end" });
    try {
      await updateAdminHomework(hw.id, { status: "CLOSED" });
      invalidateHomeworks();
      invalidateSessionScores();
      feedback.success("과제를 종료했습니다.");
    } catch (e: unknown) {
      feedback.error(getErrorDetail(e));
    } finally {
      setHwBusy(null);
    }
  };

  const handleExamProgress = async (id: number) => {
    if (examBusy) return;
    setExamBusy({ id, action: "start" });
    try {
      await updateAdminExam(id, { status: "OPEN" });
      qc.invalidateQueries({ queryKey: ["admin-exam", id] });
      invalidateExams();
      invalidateExamsSummary();
      invalidateSessionScores();
      feedback.success("시험을 진행 중으로 변경했습니다.");
    } catch (e: unknown) {
      feedback.error(getErrorDetail(e));
    } finally {
      setExamBusy(null);
    }
  };

  const handleExamClose = async (id: number) => {
    const ok = await confirm({ title: "종료 확인", message: "시험을 종료하시겠습니까? 종료 이후엔 답안 제출이 불가합니다.", danger: true, confirmText: "종료" });
    if (!ok) return;
    setExamBusy({ id, action: "end" });
    try {
      await updateAdminExam(id, { status: "CLOSED" });
      qc.invalidateQueries({ queryKey: ["admin-exam", id] });
      invalidateExams();
      invalidateExamsSummary();
      invalidateSessionScores();
      feedback.success("시험을 종료했습니다.");
    } catch (e: unknown) {
      feedback.error(getErrorDetail(e));
    } finally {
      setExamBusy(null);
    }
  };

  return (
    <aside style={S.aside}>
      {/* ── Bundle apply button ── */}
      <button
        type="button"
        onClick={() => setOpenApplyBundle(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border-divider)] py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:border-[var(--color-brand-primary)] transition-colors bg-[var(--color-bg-surface)]"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.7 }}>
          <path d="M2 3.5A1.5 1.5 0 013.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a1.5 1.5 0 001.06.44H12.5A1.5 1.5 0 0114 5v7.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z" fill="currentColor"/>
        </svg>
        묶음 불러오기
      </button>

      {/* ── Exams Section ── */}
      <section style={S.section}>
        <div style={S.sectionHeader}>
          <div style={S.sectionTitle}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.55 }}>
              <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zm1 3v2h8V5H4zm0 4v2h5V9H4z" fill="currentColor"/>
            </svg>
            <span>시험</span>
            <span style={S.countBadge}>{examsLoading ? "-" : exams.length}</span>
          </div>
          <Button type="button" intent="ghost" size="sm" onClick={setOpenCreateExam}>
            + 추가
          </Button>
        </div>

        <div style={S.itemList}>
          {examsLoading && <EmptyState>불러오는 중...</EmptyState>}
          {!examsLoading && examsError && <EmptyState>시험 목록을 불러오지 못했습니다</EmptyState>}
          {!examsLoading && !examsError && exams.length === 0 && <EmptyState>등록된 시험이 없습니다</EmptyState>}
          {exams.map((exam: SessionExamRow) => {
            const active = examId != null && Number(exam.exam_id) === examId;
            const busy = examBusy?.id === Number(exam.exam_id) ? examBusy.action : null;
            const maxScore = examMaxScoreById[Number(exam.exam_id)] ?? 100;
            const gradedCount = examGradedCountById[Number(exam.exam_id)] ?? 0;
            return (
              <ExamItemCard
                key={exam.exam_id}
                active={active}
                label={exam.title}
                status={exam.status}
                maxScore={maxScore}
                gradedCount={gradedCount}
                onSelect={() => onSelectExam(Number(exam.exam_id))}
                onStart={(e) => { e.stopPropagation(); handleExamProgress(Number(exam.exam_id)); }}
                onEnd={(e) => { e.stopPropagation(); handleExamClose(Number(exam.exam_id)); }}
                busy={busy}
              />
            );
          })}
        </div>
      </section>

      {/* ── Homework Section ── */}
      <section style={S.section}>
        <div style={S.sectionHeader}>
          <div style={S.sectionTitle}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.55 }}>
              <path d="M4 1a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V5.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 009.586 1H4zm0 1.5h5v2.25c0 .414.336.75.75.75H12v7.5a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-10a.5.5 0 01.5-.5z" fill="currentColor"/>
            </svg>
            <span>과제</span>
            <span style={S.countBadge}>{hwLoading ? "-" : homeworks.length}</span>
          </div>
          <Button type="button" intent="ghost" size="sm" onClick={setOpenCreateHomework}>
            + 추가
          </Button>
        </div>

        <div style={S.itemList}>
          {hwLoading && <EmptyState>불러오는 중...</EmptyState>}
          {!hwLoading && hwError && <EmptyState>과제 목록을 불러오지 못했습니다</EmptyState>}
          {!hwLoading && !hwError && homeworks.length === 0 && <EmptyState>등록된 과제가 없습니다</EmptyState>}
          {homeworks.map((hw) => {
            const active = homeworkId === hw.id;
            const cutlineMode = homeworkPolicy?.cutline_mode ?? "PERCENT";
            const cutlineValue = homeworkPolicy?.cutline_value ?? 80;
            return (
              <HomeworkItemCard
                key={hw.id}
                active={active}
                label={hw.title}
                status={hw.status ?? "OPEN"}
                cutlineMode={cutlineMode}
                cutlineValue={cutlineValue}
                busy={hwBusy?.id === hw.id}
                onSelect={() => onSelectHomework(hw.id)}
                onStart={(e) => { e.stopPropagation(); handleHomeworkProgress(hw); }}
                onEnd={(e) => { e.stopPropagation(); handleHomeworkClose(hw); }}
              />
            );
          })}
        </div>
      </section>

      {/* ── Modals ── */}
      <CreateRegularExamModal
        open={openCreateExam}
        onClose={handleCloseCreateExam}
        sessionId={sessionId}
        lectureId={lectureId}
        onCreated={async (id) => {
          try { await updateAdminExam(id, { status: "OPEN" }); } catch { /* noop */ }
          invalidateExams();
          invalidateExamsSummary();
          invalidateSessionScores();
          feedback.success("시험이 생성되어 진행 상태로 전환되었습니다.");
          onSelectExam(id);
        }}
      />
      <CreateHomeworkModal
        open={openCreateHomework}
        onClose={handleCloseCreateHomework}
        sessionId={sessionId}
        onCreated={async (id) => {
          try { await updateAdminHomework(id, { status: "OPEN" }); } catch { /* noop */ }
          invalidateHomeworks();
          invalidateSessionScores();
          feedback.success("과제가 생성되어 진행 상태로 전환되었습니다.");
          onSelectHomework(id);
        }}
      />
      <ApplyBundleModal
        open={openApplyBundle}
        onClose={() => setOpenApplyBundle(false)}
        sessionId={sessionId}
        onApplied={({ examIds, homeworkIds }) => {
          invalidateExams();
          invalidateExamsSummary();
          invalidateHomeworks();
          invalidateSessionScores();
          if (examIds.length > 0) onSelectExam(examIds[0]);
          else if (homeworkIds.length > 0) onSelectHomework(homeworkIds[0]);
        }}
      />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  ExamItemCard                                                       */
/* ------------------------------------------------------------------ */

function ExamItemCard({
  active,
  label,
  status,
  maxScore,
  gradedCount,
  onSelect,
  onStart,
  onEnd,
  busy,
}: {
  active: boolean;
  label: string;
  status: SessionExamRow["status"];
  maxScore: number;
  gradedCount: number;
  onSelect: () => void;
  onStart: (e: React.MouseEvent) => void;
  onEnd: (e: React.MouseEvent) => void;
  busy: null | "start" | "end";
}) {
  const isOpen = status === "OPEN";

  const statusLabel = isOpen ? "진행" : "마감";
  const statusTone: StatusTone = isOpen ? "success" : "danger";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      style={S.card(active, status)}
    >
      {/* Top row: badge + title */}
      <div style={S.cardTopRow}>
        <StatusBadge label={statusLabel} tone={statusTone} />
        <div style={S.cardTitle} title={label}>{label}</div>
      </div>

      {/* Meta + action buttons in one row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <div style={S.cardMeta}>
          만점 {maxScore}점 · 채점 {gradedCount}명
        </div>
        <div style={S.actionsRow} onClick={(e) => e.stopPropagation()}>
          {!isOpen && (
            <Button type="button" size="sm" intent="primary" onClick={onStart} disabled={busy != null} loading={busy === "start"}>
              시험 시작
            </Button>
          )}
          {isOpen && (
            <Button type="button" size="sm" intent="danger" onClick={onEnd} disabled={busy != null} loading={busy === "end"}>
              시험 종료
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HomeworkItemCard                                                    */
/* ------------------------------------------------------------------ */

function HomeworkItemCard({
  active,
  label,
  status,
  cutlineMode,
  cutlineValue,
  busy,
  onSelect,
  onStart,
  onEnd,
}: {
  active: boolean;
  label: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  cutlineMode: "PERCENT" | "COUNT";
  cutlineValue: number;
  busy?: boolean;
  onSelect: () => void;
  onStart: (e: React.MouseEvent) => void;
  onEnd: (e: React.MouseEvent) => void;
}) {
  const isOpen = status === "OPEN";
  const statusLabel = isOpen ? "진행" : "마감";
  const statusTone: StatusTone = isOpen ? "success" : "danger";

  const metaLabel =
    cutlineMode === "PERCENT"
      ? `기준 ${cutlineValue}%`
      : `기준 ${cutlineValue}점`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      style={S.card(active, status)}
    >
      {/* Top row: badge + title */}
      <div style={S.cardTopRow}>
        <StatusBadge label={statusLabel} tone={statusTone} />
        <div style={S.cardTitle} title={label}>{label}</div>
      </div>

      {/* Meta + action buttons in one row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <div style={S.cardMeta}>
          {metaLabel}
        </div>
        <div style={S.actionsRow} onClick={(e) => e.stopPropagation()}>
          {!isOpen && (
            <Button type="button" size="sm" intent="primary" onClick={onStart} disabled={busy}>
              과제 시작
            </Button>
          )}
          {isOpen && (
            <Button type="button" size="sm" intent="secondary" onClick={onEnd} disabled={busy}>
              {busy ? "처리 중…" : "과제 종료"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EmptyState                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={S.emptyState}>{children}</div>;
}
