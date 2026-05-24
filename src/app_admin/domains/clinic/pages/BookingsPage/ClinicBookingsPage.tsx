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

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
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
} from "lucide-react";

import { useClinicTargets } from "../../hooks/useClinicTargets";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import type { ClinicTarget } from "../../api/clinicTargets";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import { patchClinicParticipantStatus } from "../../api/clinicParticipants.api";
import {
  resolveClinicLink,
  waiveClinicLink,
  carryOverClinicLink,
  submitClinicRetake,
} from "../../api/clinicLinks.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import ClinicSectionFilter from "../../components/ClinicSectionFilter";
import { clinicQueryKeys } from "../../queryKeys";

/* ── Types ── */

type StudentGroup = {
  studentName: string;
  enrollmentId: number;
  items: ClinicTarget[];
  openCount: number;
};

type ViewMode = "students" | "items";
type ReasonFilter = "all" | "score" | "confidence" | "missing";

/* ── Helpers ── */

const REASON_LABEL: Record<string, string> = {
  score: "불합격",
  confidence: "신뢰도 낮음",
  missing: "미응시",
};

const REASON_COLOR: Record<string, string> = {
  score: "var(--color-error)",
  confidence: "var(--color-info, #3b82f6)",
  missing: "var(--color-warning, #f59e0b)",
};

function formatNextAttempt(latestIndex?: number): string {
  const next = (latestIndex ?? 1) + 1;
  return `${next}차`;
}

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

function formatScoreDisplay(item: ClinicTarget): string {
  const score = item.exam_score;
  const cutline = item.cutline_score;
  if (score == null) return "-";
  return `${score}/${cutline ?? "-"}`;
}

function requestScheduleText(row: ClinicParticipant): string {
  const time = row.session_start_time ? row.session_start_time.slice(0, 5) : "-";
  const location = row.session_location ? ` · ${row.session_location}` : "";
  return `${row.session_date} ${time}${location}`;
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
          {pendingRows.length > 0 ? (
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
                        <span className="clinic-bookings__pending-item-name">{row.student_name}</span>
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
  const { data: targets = [], isLoading } = useClinicTargets(
    sectionFilter ? { section_id: sectionFilter } : undefined,
  );

  const [viewMode, setViewMode] = useState<ViewMode>("items");
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [showResolved, setShowResolved] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());

  /* ── Mutations ── */
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: clinicQueryKeys.targets });
    qc.invalidateQueries({ queryKey: clinicQueryKeys.participants });
  };

  const resolveMutation = useMutation({
    mutationFn: (id: number) => resolveClinicLink(id),
    onSuccess: () => { invalidateAll(); feedback.success("통과 처리되었습니다."); },
    onError: () => feedback.error("통과 처리에 실패했습니다."),
  });

  const waiveMutation = useMutation({
    mutationFn: (id: number) => waiveClinicLink(id),
    onSuccess: () => { invalidateAll(); feedback.success("면제 처리되었습니다."); },
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
    waiveMutation.isPending ||
    carryOverMutation.isPending ||
    retakeMutation.isPending;

  /* ── Filtered data ── */
  const filtered = useMemo(() => {
    let list = targets;
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
  }, [targets, search, reasonFilter, showResolved]);

  /* ── Student groups ── */
  const studentGroups = useMemo(() => {
    const map = new Map<number, StudentGroup>();
    for (const t of filtered) {
      const existing = map.get(t.enrollment_id);
      if (existing) {
        existing.items.push(t);
        if (!t.resolved_at) existing.openCount++;
      } else {
        map.set(t.enrollment_id, {
          studentName: t.student_name,
          enrollmentId: t.enrollment_id,
          items: [t],
          openCount: t.resolved_at ? 0 : 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.openCount - a.openCount);
  }, [filtered]);

  /* ── KPI ── */
  const kpi = useMemo(() => {
    const openItems = targets.filter((t) => !t.resolved_at);
    const scoreItems = openItems.filter((t) => t.reason === "score");
    const uniqueStudents = new Set(openItems.map((t) => t.enrollment_id));
    return {
      totalStudents: uniqueStudents.size,
      totalItems: openItems.length,
      scoreItems: scoreItems.length,
    };
  }, [targets]);

  /* ── Toggle student expand ── */
  function toggleStudent(enrollmentId: number) {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) next.delete(enrollmentId);
      else next.add(enrollmentId);
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
        <div className="clinic-hub__kpi-row">
          <div className="clinic-hub__kpi clinic-hub__kpi--primary">
            <Users size={16} />
            <div>
              <span className="clinic-hub__kpi-value">{kpi.totalStudents}</span>
              <span className="clinic-hub__kpi-label">진행중 학생</span>
            </div>
          </div>
          <div className="clinic-hub__kpi clinic-hub__kpi--danger">
            <AlertTriangle size={16} />
            <div>
              <span className="clinic-hub__kpi-value">{kpi.totalItems}</span>
              <span className="clinic-hub__kpi-label">진행중 항목</span>
            </div>
          </div>
          <div className="clinic-hub__kpi">
            <FileQuestion size={16} />
            <div>
              <span className="clinic-hub__kpi-value">{kpi.scoreItems}</span>
              <span className="clinic-hub__kpi-label">시험 불합격</span>
            </div>
          </div>
        </div>

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
                  <th>강의</th>
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
                    onResolve={() => item.clinic_link_id && resolveMutation.mutate(item.clinic_link_id)}
                    onWaive={() => item.clinic_link_id && waiveMutation.mutate(item.clinic_link_id)}
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
              const isExpanded = expandedStudents.has(group.enrollmentId);
              return (
                <div
                  key={group.enrollmentId}
                  className={`clinic-hub__student-card ${isExpanded ? "clinic-hub__student-card--expanded" : ""}`}
                >
                  <button
                    type="button"
                    className="clinic-hub__student-header"
                    onClick={() => toggleStudent(group.enrollmentId)}
                  >
                    <span className="clinic-hub__student-expand">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span className="clinic-hub__student-name">
                      <StudentNameWithLectureChip
                        name={group.studentName}
                        lectures={group.items[0]?.lecture_title ? [{ lectureName: group.items[0].lecture_title, color: group.items[0].lecture_color, chipLabel: group.items[0].lecture_chip_label }] : undefined}
                        clinicHighlight={group.items.some(i => i.name_highlight_clinic_target)}
                        profilePhotoUrl={group.items[0]?.profile_photo_url}
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
                          onResolve={() => item.clinic_link_id && resolveMutation.mutate(item.clinic_link_id)}
                          onWaive={() => item.clinic_link_id && waiveMutation.mutate(item.clinic_link_id)}
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
    </section>
  );
}

/* ══════════════════════════════════════════ */
/* RetakeTableRow — 항목별 뷰의 테이블 행 (인라인 점수 입력) */
/* ══════════════════════════════════════════ */

function RetakeTableRow({
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
  const [scoreInput, setScoreInput] = useState("");
  const [showMore, setShowMore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isResolved = !!item.resolved_at;
  const typeLabel = item.source_type === "homework" ? "과제" : "시험";
  const maxScore = item.max_score ?? 100;

  function handleSubmit() {
    const val = parseFloat(scoreInput);
    if (isNaN(val) || val < 0) {
      feedback.error("올바른 점수를 입력해주세요.");
      return;
    }
    if (maxScore != null && val > maxScore) {
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
    <tr className={isResolved ? "clinic-hub__row--resolved" : ""}>
      <td className="clinic-hub__cell-name">
        <StudentNameWithLectureChip
          name={item.student_name}
          lectures={item.lecture_title ? [{ lectureName: item.lecture_title, color: item.lecture_color, chipLabel: item.lecture_chip_label }] : undefined}
          clinicHighlight={item.name_highlight_clinic_target}
          profilePhotoUrl={item.profile_photo_url}
          avatarSize={20}
        />
      </td>
      <td className="clinic-hub__cell-lecture">{item.lecture_title || "-"}</td>
      <td className="clinic-hub__cell-session">{item.session_title || "-"}</td>
      <td className="clinic-hub__cell-source">
        <span title={item.source_title || "-"}>
          {item.source_title || "-"}
        </span>
      </td>
      <td>
        <span
          className="clinic-hub__type-badge"
          data-type={item.source_type}
        >
          {typeLabel}
        </span>
      </td>
      <td className="clinic-hub__cell-score">
        {formatScoreDisplay(item)}
      </td>
      <td className="clinic-hub__cell-score">
        {item.cutline_score ?? "-"}
      </td>
      <td className="clinic-hub__cell-cycle">
        {formatNextAttempt(item.latest_attempt_index)}
      </td>
      <td className="clinic-hub__cell-input">
        {!isResolved && item.clinic_link_id ? (
          <div className="clinic-hub__score-input-group">
            <input
              ref={inputRef}
              type="number"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="점수"
              className="clinic-hub__score-input"
              min={0}
              max={maxScore ?? undefined}
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
        ) : isResolved ? (
          <span className="clinic-hub__resolved-inline">
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
        ) : (
          <span className="clinic-hub__cell-muted">-</span>
        )}
      </td>
      <td className="clinic-hub__cell-actions">
        {!isResolved && item.clinic_link_id ? (
          <div className="clinic-hub__inline-actions">
            <button
              type="button"
              className="clinic-hub__action-sm clinic-hub__action-sm--resolve"
              onClick={onResolve}
              disabled={disabled}
              title="수동 통과"
            >
              <CheckCircle2 size={13} />
            </button>
            <div className="clinic-hub__action-more-wrap">
              <button
                type="button"
                className="clinic-hub__action-more"
                onClick={() => setShowMore(!showMore)}
                title="더보기"
              >
                <MoreHorizontal size={13} />
              </button>
              {showMore && (
                <div className="clinic-hub__action-dropdown">
                  <button type="button" onClick={() => { onWaive(); setShowMore(false); }} disabled={disabled}>
                    면제
                  </button>
                  <button type="button" onClick={() => { onCarryOver(); setShowMore(false); }} disabled={disabled}>
                    다음 차수 이월
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <span className="clinic-hub__cell-muted">-</span>
        )}
      </td>
    </tr>
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

          {/* Lecture / Session breadcrumb */}
          <span className="clinic-hub__item-breadcrumb">
            {item.lecture_title ? `${item.lecture_title} · ` : ""}
            {item.session_title || ""}
          </span>

          {/* Reason badge */}
          <span
            className="clinic-hub__item-reason"
            style={reasonColorStyle(item.reason)}
          >
            {REASON_LABEL[item.reason ?? "score"]}
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
          {item.exam_score != null ? (
            <span className="clinic-hub__item-score">
              1차: {item.exam_score}/{item.cutline_score ?? "-"}점
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
          {!isResolved && item.clinic_link_id && (
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
        {!isResolved && item.clinic_link_id && (
          <>
            <button
              type="button"
              className="clinic-hub__action-btn clinic-hub__action-btn--resolve"
              onClick={onResolve}
              disabled={disabled}
              title="수동 통과"
            >
              <CheckCircle2 size={14} />
              통과
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
