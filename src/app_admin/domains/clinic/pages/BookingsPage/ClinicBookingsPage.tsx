// PATH: src/app_admin/domains/clinic/pages/BookingsPage/ClinicBookingsPage.tsx
/**
 * 클리닉 통과 워크스페이스
 *
 * 핵심 UX:
 * - 모든 진행중 항목을 한 화면에서 보고 점수 입력으로 즉시 통과 처리
 * - 항목별 뷰: 시험/과제 재시도 점수를 인라인으로 입력
 * - 학생별 뷰: 학생 단위로 묶어서 보기
 * - Tab/Enter로 빠른 이동
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileQuestion,
  BookOpen,
  Users,
  List,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Search,
  ArrowRight,
  XCircle,
  ShieldCheck,
} from "lucide-react";

import { useClinicTargets } from "../../hooks/useClinicTargets";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import type { ClinicTarget } from "../../api/clinicTargets";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import { patchClinicParticipantStatus } from "../../api/clinicParticipants.api";
import {
  resolveClinicLink,
  waiveClinicLink,
  waiveMissingExamTarget,
  carryOverClinicLink,
  submitClinicRetake,
} from "../../api/clinicLinks.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";
import ClinicSectionFilter from "../../components/ClinicSectionFilter";
import { hhmmText } from "@/shared/ui/time/timeFormat";
import { clinicQueryKeys } from "../../queryKeys";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";
import RetakeTableRow from "./RetakeTableRow";
import { formatNextAttempt, formatScoreDisplay } from "./remediationFormatters";
import ClinicManualHomeworkCompleteDialog from "../../components/ClinicManualHomeworkCompleteDialog";
import {
  canCompleteManualHomework,
  canWaiveMissingExam,
  clinicTargetKey,
  completeManualHomework,
  isPositiveClinicIdentifier,
  isVisibleRemediationTarget,
  requiresManualHomeworkCompletion,
} from "../../api/completeManualHomework";
import RemediationKpiRow from "./RemediationKpiRow";

/* ── Types ── */

type StudentGroup = {
  key: string;
  studentName: string;
  items: ClinicTarget[];
  openCount: number;
};

type ViewMode = "students" | "items";
type ReasonFilter = "all" | "score" | "confidence" | "missing";

/* ── Helpers ── */

const REASON_LABEL: Record<string, string> = {
  score: "불합격",
  confidence: "신뢰도 낮음",
  missing: "미응시·미제출",
};

const REASON_COLOR: Record<string, string> = {
  score: "var(--color-error)",
  confidence: "var(--color-info, #3b82f6)",
  missing: "var(--color-warning, #f59e0b)",
};

function reasonBorderStyle(reason: string | null | undefined): CSSProperties {
  return { borderColor: REASON_COLOR[reason ?? "score"] };
}

function reasonColorStyle(reason: string | null | undefined): CSSProperties {
  return { color: REASON_COLOR[reason ?? "score"] };
}

function indicatorStyle(reason: string | null | undefined, isResolved: boolean): CSSProperties {
  return {
    backgroundColor: isResolved ? "var(--color-success)" : REASON_COLOR[reason ?? "score"],
  };
}

function formatReasonLabel(item: ClinicTarget): string {
  if (item.reason === "missing") {
    return item.source_type === "homework" ? "미제출" : "미응시";
  }
  return REASON_LABEL[item.reason ?? "score"];
}

function requestScheduleText(row: ClinicParticipant): string {
  const time = hhmmText(row.session_start_time, "-");
  const title = row.session_title ? `${row.session_title} · ` : "";
  const location = row.session_location ? ` · ${row.session_location}` : "";
  return `${title}${row.session_date} ${time}${location}`;
}

function targetStudentKey(target: ClinicTarget): string {
  return target.student_id
    ? `student:${target.student_id}`
    : `enrollment:${target.enrollment_id}`;
}

function targetLectures(items: ClinicTarget[]) {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (!item.lecture_title) return [];
    const key = `${item.lecture_id ?? ""}:${item.lecture_title}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      lectureName: item.lecture_title,
      color: item.lecture_color,
      chipLabel: item.lecture_chip_label,
    }];
  });
}

/* ══════════════════════════════════════════ */

export default function ClinicBookingsPage() {
  const [sp] = useSearchParams();
  const qc = useQueryClient();
  const [approvalsOpen, setApprovalsOpen] = useState(() => sp.get("focus") === "pending");
  const pendingParticipants = useClinicParticipants({ status: "pending" });
  const pendingRows = pendingParticipants.listQ.data ?? [];

  useEffect(() => {
    if (sp.get("focus") === "pending") setApprovalsOpen(true);
  }, [sp]);

  const approvalMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "booked" | "rejected" }) =>
      patchClinicParticipantStatus(id, { status }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
      qc.invalidateQueries({ queryKey: clinicQueryKeys.sessionsTree });
      qc.invalidateQueries({ queryKey: clinicQueryKeys.notificationCounts });
      feedback.success(variables.status === "booked" ? "예약을 승인했습니다." : "예약을 거절했습니다.");
    },
    onError: (_error, variables) => {
      feedback.error(variables.status === "booked" ? "예약 승인에 실패했습니다." : "예약 거절에 실패했습니다.");
    },
  });

  return (
    <div className="clinic-page clinic-bookings-page">
      <section className="clinic-bookings__pending" aria-label="예약 승인 대기">
        <button
          type="button"
          className="clinic-bookings__pending-header"
          onClick={() => setApprovalsOpen((v) => !v)}
          aria-expanded={approvalsOpen}
        >
          <span className="clinic-bookings__pending-toggle">
            {approvalsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span className="clinic-bookings__pending-title">예약 승인 대기</span>
          {pendingParticipants.listQ.isError ? (
            <span className="clinic-bookings__pending-done">
              <AlertTriangle size={14} />
              확인 실패
            </span>
          ) : pendingRows.length > 0 ? (
            <span className="clinic-bookings__pending-badge">{pendingRows.length}</span>
          ) : (
            <span className="clinic-bookings__pending-done">
              <CheckCircle2 size={14} />
              처리할 신청 없음
            </span>
          )}
        </button>

        {approvalsOpen && (
          <div className="clinic-bookings__pending-body">
            {pendingParticipants.listQ.isLoading ? (
              <div className="clinic-bookings__targets-empty">예약 신청을 불러오는 중...</div>
            ) : pendingParticipants.listQ.isError ? (
              <EmptyState
                scope="panel"
                tone="error"
                title="예약 신청을 불러오지 못했습니다"
                description="빈 목록으로 판단하지 않았습니다. 연결을 확인한 뒤 다시 시도해 주세요."
                actions={(
                  <Button
                    intent="secondary"
                    size="sm"
                    onClick={() => void pendingParticipants.listQ.refetch()}
                  >
                    다시 시도
                  </Button>
                )}
              />
            ) : pendingRows.length === 0 ? (
              <div className="clinic-bookings__targets-empty">
                <p className="clinic-bookings__targets-empty-title">승인 대기 예약이 없습니다.</p>
                <p className="clinic-bookings__targets-empty-desc">학생 신청이 들어오면 이곳에서 승인하거나 거절할 수 있습니다.</p>
              </div>
            ) : (
              <ul className="clinic-bookings__pending-list">
                {pendingRows.map((row) => {
                  const busy = approvalMutation.isPending;
                  return (
                      <li key={row.id} className="clinic-bookings__pending-item">
                        <div className="clinic-bookings__pending-item-info">
                          <StudentDetailLink studentId={row.student} studentName={row.student_name}>
                            <StudentNameWithLectureChip
                              name={row.student_name}
                              lectures={row.lecture_title ? [{
                                lectureName: row.lecture_title,
                                color: row.lecture_color,
                                chipLabel: row.lecture_chip_label,
                              }] : undefined}
                              clinicHighlight={row.name_highlight_clinic_target}
                              profilePhotoUrl={row.profile_photo_url}
                              enrollmentId={row.enrollment_id}
                              avatarSize={20}
                              density="compact"
                              className="clinic-bookings__pending-item-name"
                            />
                          </StudentDetailLink>
                        <span className="clinic-bookings__pending-item-meta">
                          <Clock size={13} aria-hidden />
                          {requestScheduleText(row)}
                        </span>
                      </div>
                      <div className="clinic-bookings__pending-actions">
                        <button
                          type="button"
                          className="clinic-bookings__action-btn clinic-bookings__action-btn--approve"
                          disabled={busy}
                          onClick={() => approvalMutation.mutate({ id: row.id, status: "booked" })}
                        >
                          <CheckCircle2 size={13} aria-hidden />
                          승인
                        </button>
                        <button
                          type="button"
                          className="clinic-bookings__action-btn clinic-bookings__action-btn--reject"
                          disabled={busy}
                          onClick={() => approvalMutation.mutate({ id: row.id, status: "rejected" })}
                        >
                          <XCircle size={13} aria-hidden />
                          거절
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      <RemediationWorkspace />
    </div>
  );
}

function RemediationWorkspace() {
  const qc = useQueryClient();
  const [sectionFilter, setSectionFilter] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const targetsQuery = useClinicTargets({
    section_id: sectionFilter ?? undefined,
    include_resolved: showResolved,
  });
  const { data: targets = [], isLoading, isError } = targetsQuery;

  const [viewMode, setViewMode] = useState<ViewMode>("items");
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [waiveTarget, setWaiveTarget] = useState<ClinicTarget | null>(null);
  const [waiveMemo, setWaiveMemo] = useState("");
  const [completeTarget, setCompleteTarget] = useState<ClinicTarget | null>(null);

  /* ── Mutations ── */
  const invalidateAll = () => Promise.all([
    qc.invalidateQueries({ queryKey: clinicQueryKeys.targets }),
    qc.invalidateQueries({ queryKey: clinicQueryKeys.participants }),
  ]);

  const resolveMutation = useMutation({
    mutationFn: ({ id, memo }: { id: number; memo?: string }) => resolveClinicLink(id, memo),
    onSuccess: async () => {
      await invalidateAll();
      feedback.success("통과 처리되었습니다.");
    },
    onError: () => feedback.error("통과 처리에 실패했습니다."),
  });

  const homeworkCompleteMutation = useMutation({
    mutationFn: async ({ target, memo }: { target: ClinicTarget; memo: string }) => {
      await completeManualHomework(target, memo);
      const refreshed = await targetsQuery.refetch();
      const targetKey = clinicTargetKey(target);
      if (
        refreshed.isError ||
        !Array.isArray(refreshed.data) ||
        refreshed.data.some((item) => !item.resolved_at && clinicTargetKey(item) === targetKey)
      ) {
        throw new Error("homework_completion_not_persisted");
      }
      await qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
    },
    onSuccess: async () => {
      setCompleteTarget(null);
      feedback.success("과제 제출 확인과 완료 처리를 저장했습니다.");
    },
    onError: () => feedback.error("완료 상태를 다시 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."),
  });

  const waiveMutation = useMutation({
    mutationFn: async ({ target, memo }: { target: ClinicTarget; memo: string }) => {
      const linkId = isPositiveClinicIdentifier(target.clinic_link_id)
        ? target.clinic_link_id
        : null;
      if (!canWaiveMissingExam(target)) {
        throw new Error("면제 대상 식별자가 없습니다.");
      }
      if (linkId) return waiveClinicLink(linkId, memo);
      return waiveMissingExamTarget({
        session_id: target.session_id!,
        enrollment_id: target.enrollment_id!,
        exam_id: target.exam_id!,
        memo,
      });
    },
    onSuccess: () => {
      invalidateAll();
      setWaiveTarget(null);
      setWaiveMemo("");
      feedback.success("클리닉 면제 처리와 사유 기록을 완료했습니다.");
    },
    onError: () => feedback.error("면제 처리에 실패했습니다."),
  });

  const carryOverMutation = useMutation({
    mutationFn: (id: number) => carryOverClinicLink(id),
    onSuccess: () => { invalidateAll(); feedback.success("다음 차수로 이월되었습니다."); },
    onError: () => feedback.error("이월 처리에 실패했습니다."),
  });

  const retakeMutation = useMutation({
    mutationFn: (params: { id: number; score: number; max_score?: number }) =>
      submitClinicRetake(params.id, { score: params.score, max_score: params.max_score }),
    onSuccess: (data) => {
      invalidateAll();
      if (data.passed) {
        feedback.success(`합격! (${data.score}점, ${data.attempt_index}차) — 자동 통과`);
      } else {
        feedback.warning(`미통과 (${data.score}점, ${data.attempt_index}차) — 재시도 가능`);
      }
    },
    onError: () => feedback.error("점수 저장에 실패했습니다."),
  });

  const isMutating =
    resolveMutation.isPending ||
    homeworkCompleteMutation.isPending ||
    waiveMutation.isPending ||
    carryOverMutation.isPending ||
    retakeMutation.isPending;
  /* ── Filtered data ── */
  const visibleTargets = useMemo(() => targets.filter(isVisibleRemediationTarget), [targets]);
  const filtered = useMemo(() => {
    let list = visibleTargets;
    if (!showResolved) {
      list = list.filter((t) => !t.resolved_at);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.student_name.toLowerCase().includes(q) ||
          (t.session_title || "").toLowerCase().includes(q) ||
          (t.source_title || "").toLowerCase().includes(q) ||
          (t.lecture_title || "").toLowerCase().includes(q),
      );
    }
    if (reasonFilter !== "all") {
      list = list.filter((t) => t.reason === reasonFilter);
    }
    return list;
  }, [visibleTargets, search, reasonFilter, showResolved]);

  /* ── Student groups ── */
  const studentGroups = useMemo(() => {
    const map = new Map<string, StudentGroup>();
    for (const t of filtered) {
      const key = targetStudentKey(t);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(t);
        if (!t.resolved_at) existing.openCount++;
      } else {
        map.set(key, {
          key,
          studentName: t.student_name,
          items: [t],
          openCount: t.resolved_at ? 0 : 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.openCount - a.openCount);
  }, [filtered]);

  /* ── KPI ── */
  const kpi = useMemo(() => {
    const openItems = visibleTargets.filter((t) => !t.resolved_at);
    const examItems = openItems.filter((t) => t.source_type === "exam" && t.reason === "score");
    const homeworkItems = openItems.filter((t) => t.source_type === "homework" && t.reason === "score");
    const missingItems = openItems.filter((t) => t.reason === "missing");
    const uniqueStudents = new Set(openItems.map(targetStudentKey));
    return {
      totalStudents: uniqueStudents.size,
      totalItems: openItems.length,
      examItems: examItems.length,
      homeworkItems: homeworkItems.length,
      missingItems: missingItems.length,
    };
  }, [visibleTargets]);

  /* ── Toggle student expand ── */
  function toggleStudent(key: string) {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /* ══════════════════════════════════════════ */
  /* RENDER */
  /* ══════════════════════════════════════════ */

  return (
    <section className="clinic-bookings-page__remediation">
      <div className="clinic-hub">
        {/* ── KPI Row ── */}
        <RemediationKpiRow
          unavailable={isLoading || isError}
          loading={isLoading}
          totalStudents={kpi.totalStudents}
          examItems={kpi.examItems}
          homeworkItems={kpi.homeworkItems}
          missingItems={kpi.missingItems}
        />

        {/* ── Toolbar: view switch + filters ── */}
        <div className="clinic-hub__toolbar">
          <div className="clinic-hub__toolbar-left">
            <ClinicSectionFilter value={sectionFilter} onChange={setSectionFilter} />
            <div className="clinic-hub__view-toggle">
              <button
                type="button"
                className={`clinic-hub__view-btn ${viewMode === "items" ? "clinic-hub__view-btn--active" : ""}`}
                onClick={() => setViewMode("items")}
              >
                <List size={14} />
                항목별
              </button>
              <button
                type="button"
                className={`clinic-hub__view-btn ${viewMode === "students" ? "clinic-hub__view-btn--active" : ""}`}
                onClick={() => setViewMode("students")}
              >
                <Users size={14} />
                학생별
              </button>
            </div>

            <div className="clinic-hub__filter-chips">
              {(["all", "score", "confidence", "missing"] as ReasonFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`clinic-hub__filter-chip ${reasonFilter === r ? "clinic-hub__filter-chip--active" : ""}`}
                  onClick={() => setReasonFilter(r)}
                >
                  {r === "all" ? "전체" : REASON_LABEL[r]}
                </button>
              ))}
              <label className="clinic-hub__filter-chip clinic-hub__filter-chip--toggle">
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(e) => setShowResolved(e.target.checked)}
                />
                해결 완료 포함
              </label>
            </div>
          </div>

          <div className="clinic-hub__search">
            <Search size={14} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="학생, 강의, 시험명 검색"
              className="clinic-hub__search-input"
            />
          </div>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="clinic-hub__loading">
            <div className="clinic-hub__skeleton" />
            <div className="clinic-hub__skeleton" />
            <div className="clinic-hub__skeleton" />
          </div>
        ) : isError ? (
          <EmptyState
            scope="panel"
            tone="error"
            title="클리닉 대상자를 불러오지 못했습니다"
            description="대상자가 없는 것으로 판단하지 않았습니다. 연결을 확인한 뒤 다시 시도해 주세요."
            actions={(
              <Button
                intent="secondary"
                size="sm"
                onClick={() => void targetsQuery.refetch()}
              >
                다시 시도
              </Button>
            )}
          />
        ) : filtered.length === 0 ? (
          <div className="clinic-hub__empty">
            <CheckCircle2 size={48} className="clinic-hub__empty-icon" />
            <p className="clinic-hub__empty-title">
              {search.trim() || reasonFilter !== "all"
                ? "검색 결과가 없습니다"
                : "진행중 항목이 없습니다"}
            </p>
            <p className="clinic-hub__empty-desc">
              {search.trim() || reasonFilter !== "all"
                ? "필터를 변경하거나 검색어를 수정해 보세요."
                : "모든 학생이 시험/과제를 통과했습니다."}
            </p>
          </div>
        ) : viewMode === "items" ? (
          /* ═══ ITEM VIEW (table with inline score input) ═══ */
          <div className="ds-table-wrap">
            <table className="ds-table ds-table--flat clinic-hub__item-table">
              <thead>
                <tr>
                  <th>학생</th>
                  <th>차시</th>
                  <th>항목</th>
                  <th>유형</th>
                  <th>1차 점수</th>
                  <th>기준</th>
                  <th>재시도</th>
                  <th>점수 입력</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <RetakeTableRow
                    key={`${item.clinic_link_id ?? item.enrollment_id}-${idx}`}
                    item={item}
                    onRetake={(score, maxScore) =>
                      item.clinic_link_id &&
                      retakeMutation.mutate({
                        id: item.clinic_link_id,
                        score,
                        max_score: maxScore,
                      })
                    }
                    onResolve={() => {
                      if (!item.clinic_link_id) return;
                      if (requiresManualHomeworkCompletion(item)) {
                        if (canCompleteManualHomework(item)) setCompleteTarget(item);
                        return;
                      }
                      resolveMutation.mutate({ id: item.clinic_link_id });
                    }}
                    onWaive={() => { setWaiveTarget(item); setWaiveMemo(""); }}
                    onCarryOver={() => item.clinic_link_id && carryOverMutation.mutate(item.clinic_link_id)}
                    disabled={isMutating}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ═══ STUDENT VIEW ═══ */
          <div className="clinic-hub__student-list">
            {studentGroups.map((group) => {
              const isExpanded = expandedStudents.has(group.key);
              return (
                <div
                  key={group.key}
                  className={`clinic-hub__student-card ${isExpanded ? "clinic-hub__student-card--expanded" : ""}`}
                >
                  <button
                    type="button"
                    className="clinic-hub__student-header"
                    onClick={() => toggleStudent(group.key)}
                  >
                    <span className="clinic-hub__student-expand">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span className="clinic-hub__student-name">
                      <StudentNameWithLectureChip
                        name={group.studentName}
                        lectures={targetLectures(group.items)}
                        clinicHighlight={group.items.some(i => i.name_highlight_clinic_target)}
                        profilePhotoUrl={group.items[0]?.profile_photo_url}
                        enrollmentId={group.items[0]?.enrollment_id}
                        avatarSize={20}
                      />
                    </span>
                    <span className="clinic-hub__student-badge">
                      진행중 {group.openCount}건
                    </span>
                    <div className="clinic-hub__student-reasons">
                      {group.items.slice(0, 3).map((item, idx) => (
                        <span
                          key={`${item.enrollment_id}-${item.clinic_link_id}-${idx}`}
                          className="clinic-hub__reason-chip"
                          style={reasonBorderStyle(item.reason)}
                        >
                          {item.source_type === "homework" ? (
                            <BookOpen size={11} />
                          ) : (
                            <FileQuestion size={11} />
                          )}
                          {item.source_title || item.session_title || REASON_LABEL[item.reason ?? "score"]}
                        </span>
                      ))}
                      {group.items.length > 3 && (
                        <span className="clinic-hub__reason-chip clinic-hub__reason-chip--more">
                          +{group.items.length - 3}
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="clinic-hub__items-panel">
                      {group.items.map((item, idx) => (
                        <RemediationItemRow
                          key={`${item.clinic_link_id ?? item.enrollment_id}-${idx}`}
                          item={item}
                          onRetake={(score, maxScore) =>
                            item.clinic_link_id &&
                            retakeMutation.mutate({
                              id: item.clinic_link_id,
                              score,
                              max_score: maxScore,
                            })
                          }
                          onResolve={() => {
                            if (!item.clinic_link_id) return;
                            if (requiresManualHomeworkCompletion(item)) {
                              if (canCompleteManualHomework(item)) setCompleteTarget(item);
                              return;
                            }
                            resolveMutation.mutate({ id: item.clinic_link_id });
                          }}
                          onWaive={() => { setWaiveTarget(item); setWaiveMemo(""); }}
                          onCarryOver={() => item.clinic_link_id && carryOverMutation.mutate(item.clinic_link_id)}
                                disabled={isMutating}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AdminModal
        open={waiveTarget != null}
        onClose={() => {
          if (!waiveMutation.isPending) {
            setWaiveTarget(null);
            setWaiveMemo("");
          }
        }}
        type="confirm"
        width={480}
        noMinimize
        closeDisabled={waiveMutation.isPending}
      >
        <ModalHeader
          type="confirm"
          title="클리닉 면제 처리"
          description="점수 합격과 구분해 면제로 기록하며, 해결 완료 내역에서 다시 확인할 수 있습니다."
        />
        <ModalBody>
          <div className="clinic-hub__waive-form">
            <div className="clinic-hub__waive-target">
              <ShieldCheck size={18} aria-hidden />
              <div>
                <strong>{waiveTarget?.student_name}</strong>
                <span>{waiveTarget?.source_title || waiveTarget?.session_title} · {waiveTarget?.source_type === "homework" ? "과제" : "시험"} {waiveTarget?.reason === "missing" ? "미응시·미제출" : "클리닉 대상"}</span>
              </div>
            </div>
            <label className="clinic-hub__waive-field">
              <span>면제 사유 <em>필수</em></span>
              <textarea
                value={waiveMemo}
                onChange={(event) => setWaiveMemo(event.target.value)}
                maxLength={500}
                rows={4}
                autoFocus
                placeholder="예: 이전 수업 결석으로 이번 재시험·클리닉 면제"
              />
              <small>{waiveMemo.trim().length}/500 · 최소 2자</small>
            </label>
          </div>
        </ModalBody>
        <ModalFooter
          right={(
            <>
              <Button
                intent="secondary"
                onClick={() => { setWaiveTarget(null); setWaiveMemo(""); }}
                disabled={waiveMutation.isPending}
              >
                취소
              </Button>
              <Button
                intent="danger"
                onClick={() => waiveTarget && waiveMutation.mutate({ target: waiveTarget, memo: waiveMemo.trim() })}
                disabled={waiveMemo.trim().length < 2}
                loading={waiveMutation.isPending}
              >
                사유 남기고 면제
              </Button>
            </>
          )}
        />
      </AdminModal>
      <ClinicManualHomeworkCompleteDialog
        target={completeTarget}
        pending={homeworkCompleteMutation.isPending}
        onClose={() => setCompleteTarget(null)}
        onConfirm={(memo) => {
          if (completeTarget) homeworkCompleteMutation.mutate({ target: completeTarget, memo });
        }}
      />
    </section>
  );
}

/* ══════════════════════════════════════════ */
/* RemediationItemRow — 학생 중심 뷰의 항목 행 (인라인 점수 입력 포함) */
/* ══════════════════════════════════════════ */

function RemediationItemRow({
  item,
  onRetake,
  onResolve,
  onWaive,
  onCarryOver,
  disabled,
}: {
  item: ClinicTarget;
  onRetake: (score: number, maxScore?: number) => void;
  onResolve: () => void;
  onWaive: () => void;
  onCarryOver: () => void;
  disabled: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [scoreInput, setScoreInput] = useState("");

  const isResolved = !!item.resolved_at;
  const isMissing = item.reason === "missing";
  const maxScore = item.max_score ?? 100;

  function handleSubmit() {
    const val = parseFloat(scoreInput);
    if (isNaN(val) || val < 0) {
      feedback.error("올바른 점수를 입력해주세요.");
      return;
    }
    if (val > maxScore) {
      feedback.error(`최대 점수(${maxScore})를 초과할 수 없습니다.`);
      return;
    }
    onRetake(val, item.source_type === "homework" ? maxScore : undefined);
    setScoreInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className={`clinic-hub__item-row ${isResolved ? "clinic-hub__item-row--resolved" : ""}`}>
      {/* Left: status indicator */}
      <div
        className="clinic-hub__item-indicator"
        style={indicatorStyle(item.reason, isResolved)}
      />

      {/* Center: item info */}
      <div className="clinic-hub__item-info">
        <div className="clinic-hub__item-top">
          {/* Source title (exam/homework name) */}
          <span className="clinic-hub__item-source-title">
            {item.source_type === "homework" ? (
              <BookOpen size={12} />
            ) : (
              <FileQuestion size={12} />
            )}
            {item.source_title || item.session_title || "알 수 없는 항목"}
          </span>

          {/* Session breadcrumb — lecture is already encoded in the student chip */}
          <span className="clinic-hub__item-breadcrumb">
            {item.session_title || ""}
          </span>

          {/* Reason badge */}
          <span
            className="clinic-hub__item-reason"
            style={reasonColorStyle(item.reason)}
          >
            {formatReasonLabel(item)}
          </span>

          {isResolved && (
            <span className="clinic-hub__item-resolved">
              <CheckCircle2 size={12} />
              통과
            </span>
          )}
        </div>

        {/* Score detail + inline input */}
        <div className="clinic-hub__item-bottom">
          {/* Original score */}
          {isMissing ? (
            <span className="clinic-hub__item-score clinic-hub__item-score--missing">
              {item.source_type === "homework"
                ? "미제출 · 재제출 점수 입력 또는 교사 완료"
                : "미응시 · 응시 기록 입력 또는 결석 사유 면제"}
            </span>
          ) : item.exam_score != null || item.homework_score != null ? (
            <span className="clinic-hub__item-score">
              1차: {formatScoreDisplay(item)}
            </span>
          ) : null}

          {/* Attempt history */}
          {item.attempt_history && item.attempt_history.length > 1 && (
            <span className="clinic-hub__item-attempts">
              {item.attempt_history.slice(1).map((a) => (
                <span
                  key={a.attempt_index}
                  className={`clinic-hub__attempt-chip ${a.passed ? "clinic-hub__attempt-chip--passed" : ""}`}
                >
                  {a.attempt_index}차: {a.score ?? "-"}점
                  {a.passed ? " 합격" : ""}
                </span>
              ))}
            </span>
          )}

          {/* Inline score input */}
          {!isResolved && item.clinic_link_id && !(isMissing && item.source_type === "exam") && (
            <div className="clinic-hub__item-retake">
              <span className="clinic-hub__retake-label">
                {formatNextAttempt(item.latest_attempt_index)} 점수:
              </span>
              <div className="clinic-hub__score-input-group">
                <input
                  type="number"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="점수"
                  className="clinic-hub__score-input"
                  min={0}
                  max={maxScore}
                  step="any"
                  disabled={disabled}
                />
                <button
                  type="button"
                  className="clinic-hub__score-submit"
                  onClick={handleSubmit}
                  disabled={disabled || !scoreInput.trim()}
                  title="저장"
                >
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="clinic-hub__item-actions">
        {canWaiveMissingExam(item) ? (
          <button
            type="button"
            className="clinic-hub__action-btn clinic-hub__action-btn--waive"
            onClick={onWaive}
            disabled={disabled}
            title="결석 등 사유를 기록하고 클리닉 면제"
          >
            <ShieldCheck size={14} />
            면제
          </button>
        ) : !isResolved && item.clinic_link_id &&
          (!requiresManualHomeworkCompletion(item) || canCompleteManualHomework(item)) && (
          <>
            <button
              type="button"
              className="clinic-hub__action-btn clinic-hub__action-btn--resolve"
              onClick={onResolve}
              disabled={disabled}
              title={requiresManualHomeworkCompletion(item) ? "사이트 밖 제출 확인 후 과제 완료" : "수동 통과"}
            >
              <CheckCircle2 size={14} />
              {requiresManualHomeworkCompletion(item) ? "제출 확인·완료" : "통과"}
            </button>

            <div className="clinic-hub__action-more-wrap">
              <button
                type="button"
                className="clinic-hub__action-more"
                onClick={() => setShowActions(!showActions)}
                title="더보기"
              >
                <MoreHorizontal size={14} />
              </button>
              {showActions && (
                <div className="clinic-hub__action-dropdown">
                  <button type="button" onClick={() => { onWaive(); setShowActions(false); }} disabled={disabled}>
                    면제
                  </button>
                  <button type="button" onClick={() => { onCarryOver(); setShowActions(false); }} disabled={disabled}>
                    다음 차수 이월
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {isResolved && (
          <span className="clinic-hub__resolved-label">
            {item.resolution_type === "EXAM_PASS"
              ? "시험 통과"
              : item.resolution_type === "HOMEWORK_PASS"
                ? "과제 통과"
                : item.resolution_type === "MANUAL_OVERRIDE"
                  ? "수동 통과"
                  : item.resolution_type === "WAIVED"
                    ? "면제"
                    : "통과 완료"}
          </span>
        )}
      </div>
    </div>
  );
}
