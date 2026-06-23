// PATH: src/app_admin/domains/sessions/components/SessionAssessmentSidePanel.tsx
import { lazy, Suspense, useMemo, useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, ClipboardList, FileText, Layers, Plus } from "lucide-react";

import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import {
  fetchAssessmentHomeworkPolicyBySession,
  type AssessmentHomeworkListItem,
} from "@/shared/api/contracts/assessments";
import { fetchAdminSessionExams } from "@admin/domains/results/api/adminSessionExams";
import type { SessionExamRow } from "@admin/domains/results/api/adminSessionExams";
import {
  fetchSessionExamsSummary,
  fetchSessionHomeworks,
  sessionAssessmentQueryKeys,
} from "@admin/domains/sessions/api/sessionAssessmentQueries";

import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import {
  buildAssessmentSearch,
  readAssessmentItemId,
} from "@/shared/lib/assessmentQueryParams";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

const CreateRegularExamModal = lazy(() => import("@admin/domains/exams/components/create/CreateRegularExamModal"));
const CreateHomeworkModal = lazy(() => import("@admin/domains/homework/components/CreateHomeworkModal"));
const ApplyBundleModal = lazy(() => import("@admin/domains/exams/components/create/ApplyBundleModal"));

type Props = {
  lectureId: number;
  sessionId: number;
  activeKind?: AssessmentKind;
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
};

type AssessmentKind = "exam" | "homework";

function shouldSkipAssessmentAutoSelect(state: unknown): boolean {
  return state != null &&
    typeof state === "object" &&
    (state as { skipAssessmentAutoSelect?: unknown }).skipAssessmentAutoSelect === true;
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

  asideHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    padding: "14px",
    border: "1px solid var(--color-border-divider)",
    borderRadius: "var(--radius-md, 8px)",
    background: "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-surface)) 0%, var(--color-bg-surface) 100%)",
    boxShadow: "0 1px 3px rgba(15,23,42,.05)",
  } satisfies CSSProperties,

  asideHeaderTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-3)",
  } satisfies CSSProperties,

  asideTitleStack: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: 3,
  } satisfies CSSProperties,

  asideKicker: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--color-text-muted)",
  } satisfies CSSProperties,

  asideTitle: {
    fontSize: 15,
    fontWeight: 850,
    lineHeight: 1.2,
    color: "var(--color-text-primary)",
  } satisfies CSSProperties,

  asideMeta: {
    fontSize: 12,
    fontWeight: 650,
    color: "var(--color-text-muted)",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,

  quickNav: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
  } satisfies CSSProperties,

  quickNavButton: (active: boolean): CSSProperties => ({
    display: "flex",
    minWidth: 0,
    minHeight: 54,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    border: `1px solid ${active ? "color-mix(in srgb, var(--color-brand-primary) 52%, var(--color-border-divider))" : "var(--color-border-divider)"}`,
    borderRadius: "var(--radius-md, 8px)",
    background: active
      ? "color-mix(in srgb, var(--color-brand-primary) 9%, var(--color-bg-surface))"
      : "var(--color-bg-surface)",
    color: active ? "var(--color-brand-primary)" : "var(--color-text-secondary)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1,
  }),

  quickNavCount: {
    color: "var(--color-text-muted)",
    fontSize: 11,
    fontWeight: 750,
  } satisfies CSSProperties,

  bundleButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-2)",
    minHeight: 38,
    borderRadius: "var(--radius-md, 8px)",
    border: "1px dashed var(--color-border-divider)",
    background: "var(--color-bg-surface)",
    color: "var(--color-text-secondary)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    transition: "background 140ms ease, color 140ms ease, border-color 140ms ease",
  } satisfies CSSProperties,

  section: {
    borderRadius: "var(--radius-md, 8px)",
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
  card: (active: boolean): CSSProperties => ({
    position: "relative",
    display: "flex",
    width: "100%",
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
    textAlign: "left",
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

  emptyState: {
    padding: "18px 14px",
    textAlign: "center",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    lineHeight: 1.5,
  } satisfies CSSProperties,

  emptyTitle: {
    color: "var(--color-text-primary)",
    fontSize: 13,
    fontWeight: 750,
  } satisfies CSSProperties,

  emptyDescription: {
    marginTop: 3,
    color: "var(--color-text-muted)",
    fontSize: 12,
    fontWeight: 550,
  } satisfies CSSProperties,

  emptyAction: {
    marginTop: 10,
    display: "flex",
    justifyContent: "center",
  } satisfies CSSProperties,
} as const;

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function SessionAssessmentSidePanel({
  lectureId,
  sessionId,
  activeKind,
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
  const isMobile = useIsMobile();
  const [openCreateExamLocal, setOpenCreateExamLocal] = useState(false);
  const openCreateExam = openCreateExamProp ?? openCreateExamLocal;
  const setOpenCreateExam = onOpenCreateExam ?? (() => setOpenCreateExamLocal(true));
  const handleCloseCreateExam = onCloseCreateExam ?? (() => setOpenCreateExamLocal(false));

  const [openCreateHomeworkLocal, setOpenCreateHomeworkLocal] = useState(false);
  const openCreateHomework = openCreateHomeworkProp ?? openCreateHomeworkLocal;
  const setOpenCreateHomework = onOpenCreateHomeworkProp ?? (() => setOpenCreateHomeworkLocal(true));
  const handleCloseCreateHomework = onCloseCreateHomework ?? (() => setOpenCreateHomeworkLocal(false));

  const [openApplyBundle, setOpenApplyBundle] = useState(false);

  const examId = useMemo(() => {
    return readAssessmentItemId(searchParams, "exam");
  }, [searchParams]);

  const homeworkId = useMemo(() => {
    return readAssessmentItemId(searchParams, "homework");
  }, [searchParams]);

  const { data: exams = [], isLoading: examsLoading, isError: examsError } = useQuery({
    queryKey: sessionAssessmentQueryKeys.exams(sessionId),
    queryFn: () => fetchAdminSessionExams(sessionId),
    enabled: !!sessionId,
  });

  const { data: examsSummary } = useQuery({
    queryKey: sessionAssessmentQueryKeys.examsSummary(sessionId),
    queryFn: () => fetchSessionExamsSummary(sessionId),
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
    queryKey: sessionAssessmentQueryKeys.homeworkPolicy(sessionId),
    queryFn: () => fetchAssessmentHomeworkPolicyBySession(sessionId),
    enabled: !!sessionId,
  });

  const { data: homeworks = [], isLoading: hwLoading, isError: hwError } = useQuery({
    queryKey: sessionAssessmentQueryKeys.homeworks(sessionId),
    queryFn: async (): Promise<HomeworkItem[]> => {
      const rows: AssessmentHomeworkListItem[] = await fetchSessionHomeworks(sessionId);
      return rows.map((homework) => ({
        id: Number(homework.id),
        title: homework.title,
      }));
    },
    enabled: !!sessionId,
  });

  const base = `/admin/lectures/${lectureId}/sessions/${sessionId}`;
  const skipAutoSelect = shouldSkipAssessmentAutoSelect(location.state);
  const resolvedActiveKind: AssessmentKind =
    activeKind ?? (location.pathname.includes("/assignments") ? "homework" : "exam");
  const scoresActive = location.pathname.startsWith(`${base}/scores`);
  const examsActive = location.pathname.startsWith(`${base}/exams`);
  const assignmentsActive = location.pathname.startsWith(`${base}/assignments`);

  const asideStyle = useMemo<CSSProperties>(() => {
    if (!isMobile) return S.aside;
    return {
      ...S.aside,
      width: "100%",
      maxWidth: "100%",
      maxHeight: "none",
      position: "static",
      top: "auto",
      overflowY: "visible",
      gap: "var(--space-3)",
    };
  }, [isMobile]);

  const getSectionStyle = (kind: AssessmentKind): CSSProperties => ({
    ...S.section,
    order: kind === resolvedActiveKind ? 1 : 2,
  });

  const getItemListStyle = (kind: AssessmentKind): CSSProperties => {
    if (!isMobile) return S.itemList;
    return {
      ...S.itemList,
      maxHeight: kind === resolvedActiveKind ? 188 : 112,
      overflowY: "auto",
    };
  };

  // Auto-select or repair deleted/stale exam/homework query params on assessment tabs.
  useEffect(() => {
    if (!sessionId || !lectureId) return;
    const path = location.pathname;
    const basePath = `/admin/lectures/${lectureId}/sessions/${sessionId}`;
    if (path.startsWith(`${basePath}/exams`)) {
      if (examsLoading) return;
      const examIds = exams
        .map((exam) => Number((exam as SessionExamRow).exam_id))
        .filter((id) => Number.isFinite(id));
      if (examIds.length === 0) {
        if (examId != null) {
          navigate(
            { pathname: `${basePath}/exams`, search: "" },
            { replace: true, state: { skipAssessmentAutoSelect: true } },
          );
        }
        return;
      }
      if (examId == null) {
        if (skipAutoSelect) return;
        const firstId = examIds[0];
        if (Number.isFinite(firstId)) {
          navigate({ pathname: `${basePath}/exams`, search: buildAssessmentSearch("exam", firstId) }, { replace: true });
        }
        return;
      }
      if (!examIds.includes(examId)) {
        navigate(
          { pathname: `${basePath}/exams`, search: "" },
          { replace: true, state: { skipAssessmentAutoSelect: true } },
        );
      }
    } else if (path.startsWith(`${basePath}/assignments`)) {
      if (hwLoading) return;
      const homeworkIds = homeworks
        .map((homework) => Number(homework.id))
        .filter((id) => Number.isFinite(id));
      if (homeworkIds.length === 0) {
        if (homeworkId != null) {
          navigate(
            { pathname: `${basePath}/assignments`, search: "" },
            { replace: true, state: { skipAssessmentAutoSelect: true } },
          );
        }
        return;
      }
      if (homeworkId == null) {
        if (skipAutoSelect) return;
        const firstId = homeworkIds[0];
        if (Number.isFinite(firstId)) {
          navigate({ pathname: `${basePath}/assignments`, search: buildAssessmentSearch("homework", firstId) }, { replace: true });
        }
        return;
      }
      if (!homeworkIds.includes(homeworkId)) {
        navigate(
          { pathname: `${basePath}/assignments`, search: "" },
          { replace: true, state: { skipAssessmentAutoSelect: true } },
        );
      }
    }
  }, [location.pathname, location.state, skipAutoSelect, sessionId, lectureId, examId, homeworkId, exams, homeworks, examsLoading, hwLoading, navigate]);

  const invalidateExams = () => qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.exams(sessionId) });
  const invalidateExamsSummary = () => qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.examsSummary(sessionId) });
  const invalidateSessionScores = () => qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
  const invalidateHomeworks = () => qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.homeworks(sessionId) });

  const onSelectExam = (examId: number) => {
    navigate({ pathname: `${base}/exams`, search: buildAssessmentSearch("exam", examId) });
  };

  const onSelectHomework = (homeworkId: number) => {
    navigate({ pathname: `${base}/assignments`, search: buildAssessmentSearch("homework", homeworkId) });
  };

  return (
    <aside style={asideStyle}>
      <div style={S.asideHeader}>
        <div style={S.asideHeaderTop}>
          <div style={S.asideTitleStack}>
            <span style={S.asideKicker}>Assessment</span>
            <span style={S.asideTitle}>차시 평가</span>
          </div>
          <span style={S.asideMeta}>
            시험 {examsLoading ? "-" : exams.length} · 과제 {hwLoading ? "-" : homeworks.length}
          </span>
        </div>
        <div style={S.quickNav} aria-label="차시 평가 이동">
          <button
            type="button"
            style={S.quickNavButton(scoresActive)}
            aria-current={scoresActive ? "page" : undefined}
            onClick={() => navigate(`${base}/scores`)}
          >
            <BarChart3 size={16} aria-hidden />
            <span>성적</span>
            <span style={S.quickNavCount}>{exams.length + homeworks.length}개</span>
          </button>
          <button
            type="button"
            style={S.quickNavButton(examsActive)}
            aria-current={examsActive ? "page" : undefined}
            onClick={() => navigate(`${base}/exams`)}
          >
            <ClipboardList size={16} aria-hidden />
            <span>시험</span>
            <span style={S.quickNavCount}>{examsLoading ? "-" : exams.length}</span>
          </button>
          <button
            type="button"
            style={S.quickNavButton(assignmentsActive)}
            aria-current={assignmentsActive ? "page" : undefined}
            onClick={() => navigate(`${base}/assignments`)}
          >
            <FileText size={16} aria-hidden />
            <span>과제</span>
            <span style={S.quickNavCount}>{hwLoading ? "-" : homeworks.length}</span>
          </button>
        </div>
      </div>

      {/* ── Bundle apply button ── */}
      <button
        type="button"
        onClick={() => setOpenApplyBundle(true)}
        style={S.bundleButton}
      >
        <Layers size={ICON_FOR_BUTTON.sm} aria-hidden />
        묶음 불러오기
      </button>

      {/* ── Exams Section ── */}
      <section style={getSectionStyle("exam")}>
        <div style={S.sectionHeader}>
          <div style={S.sectionTitle}>
            <ClipboardList size={14} aria-hidden className="opacity-[0.55]" />
            <span>시험</span>
            <span style={S.countBadge}>{examsLoading ? "-" : exams.length}</span>
          </div>
          <Button type="button" intent="ghost" size="sm" leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />} onClick={setOpenCreateExam} aria-label="시험 추가">
            추가
          </Button>
        </div>

        <div style={getItemListStyle("exam")}>
          {examsLoading && <EmptyState title="불러오는 중..." />}
          {!examsLoading && examsError && <EmptyState title="시험 목록을 불러오지 못했습니다" />}
          {!examsLoading && !examsError && exams.length === 0 && (
            <EmptyState
              title="시험 없음"
              description="이 차시에 연결된 시험이 없습니다."
              action={<Button type="button" intent="secondary" size="sm" onClick={setOpenCreateExam}>시험 추가</Button>}
            />
          )}
          {exams.map((exam: SessionExamRow) => {
            const active = examId != null && Number(exam.exam_id) === examId;
            const maxScore = examMaxScoreById[Number(exam.exam_id)] ?? 100;
            const gradedCount = examGradedCountById[Number(exam.exam_id)] ?? 0;
            return (
              <ExamItemCard
                key={exam.exam_id}
                active={active}
                label={exam.title}
                maxScore={maxScore}
                gradedCount={gradedCount}
                onSelect={() => onSelectExam(Number(exam.exam_id))}
              />
            );
          })}
        </div>
      </section>

      {/* ── Homework Section ── */}
      <section style={getSectionStyle("homework")}>
        <div style={S.sectionHeader}>
          <div style={S.sectionTitle}>
            <FileText size={14} aria-hidden className="opacity-[0.55]" />
            <span>과제</span>
            <span style={S.countBadge}>{hwLoading ? "-" : homeworks.length}</span>
          </div>
          <Button type="button" intent="ghost" size="sm" leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />} onClick={setOpenCreateHomework} aria-label="과제 추가">
            추가
          </Button>
        </div>

        <div style={getItemListStyle("homework")}>
          {hwLoading && <EmptyState title="불러오는 중..." />}
          {!hwLoading && hwError && <EmptyState title="과제 목록을 불러오지 못했습니다" />}
          {!hwLoading && !hwError && homeworks.length === 0 && (
            <EmptyState
              title="과제 없음"
              description="이 차시에 연결된 과제가 없습니다."
              action={<Button type="button" intent="secondary" size="sm" onClick={setOpenCreateHomework}>과제 추가</Button>}
            />
          )}
          {homeworks.map((hw) => {
            const active = homeworkId === hw.id;
            const cutlineMode = homeworkPolicy?.cutline_mode ?? "PERCENT";
            const cutlineValue = homeworkPolicy?.cutline_value ?? 80;
            return (
              <HomeworkItemCard
                key={hw.id}
                active={active}
                label={hw.title}
                cutlineMode={cutlineMode}
                cutlineValue={cutlineValue}
                onSelect={() => onSelectHomework(hw.id)}
              />
            );
          })}
        </div>
      </section>

      {/* ── Modals ── */}
      <Suspense fallback={null}>
        {openCreateExam && (
          <CreateRegularExamModal
            open={openCreateExam}
            onClose={handleCloseCreateExam}
            sessionId={sessionId}
            lectureId={lectureId}
            onCreated={async (id) => {
              invalidateExams();
              invalidateExamsSummary();
              invalidateSessionScores();
              onSelectExam(id);
            }}
          />
        )}
        {openCreateHomework && (
          <CreateHomeworkModal
            open={openCreateHomework}
            onClose={handleCloseCreateHomework}
            sessionId={sessionId}
            onCreated={async (id) => {
              invalidateHomeworks();
              invalidateSessionScores();
              onSelectHomework(id);
            }}
          />
        )}
        {openApplyBundle && (
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
        )}
      </Suspense>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  ExamItemCard                                                       */
/* ------------------------------------------------------------------ */

function ExamItemCard({
  active,
  label,
  maxScore,
  gradedCount,
  onSelect,
}: {
  active: boolean;
  label: string;
  maxScore: number;
  gradedCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={S.card(active)}
      aria-current={active ? "true" : undefined}
    >
      <div style={S.cardTopRow}>
        <div style={S.cardTitle} title={label}>{label}</div>
      </div>
      <div style={S.cardMeta}>
        만점 {maxScore}점 · 채점 {gradedCount}명
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  HomeworkItemCard                                                    */
/* ------------------------------------------------------------------ */

function HomeworkItemCard({
  active,
  label,
  cutlineMode,
  cutlineValue,
  onSelect,
}: {
  active: boolean;
  label: string;
  cutlineMode: "PERCENT" | "COUNT";
  cutlineValue: number;
  onSelect: () => void;
}) {
  const metaLabel =
    cutlineMode === "PERCENT"
      ? `기준 ${cutlineValue}%`
      : `기준 ${cutlineValue}점`;

  return (
    <button
      type="button"
      onClick={onSelect}
      style={S.card(active)}
      aria-current={active ? "true" : undefined}
    >
      <div style={S.cardTopRow}>
        <div style={S.cardTitle} title={label}>{label}</div>
      </div>
      <div style={S.cardMeta}>{metaLabel}</div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  EmptyState                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={S.emptyState}>
      <div style={S.emptyTitle}>{title}</div>
      {description != null && <div style={S.emptyDescription}>{description}</div>}
      {action != null && <div style={S.emptyAction}>{action}</div>}
    </div>
  );
}
