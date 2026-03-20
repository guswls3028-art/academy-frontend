// PATH: src/features/clinic/pages/BookingsPage/ClinicBookingsPage.tsx
/**
 * 미해결 항목 허브 — 학생 중심 뷰 + 항목 중심 뷰
 *
 * 정보 우선순위: 미해결 항목 > 출석/예약
 * 핵심 UX: 학생별 미해결 실패 항목을 한눈에 보고, 바로 해결 액션 수행
 */

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileQuestion,
  BookOpen,
  Filter,
  Users,
  List,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Search,
} from "lucide-react";

import { useClinicTargets } from "../../hooks/useClinicTargets";
import type { ClinicTarget } from "../../api/clinicTargets";
import {
  resolveClinicLink,
  waiveClinicLink,
  carryOverClinicLink,
} from "../../api/clinicLinks.api";
import { feedback } from "@/shared/ui/feedback/feedback";

/* ── Types ── */

type StudentGroup = {
  studentName: string;
  enrollmentId: number;
  items: ClinicTarget[];
  openCount: number;
};

type ViewMode = "students" | "items";
type ReasonFilter = "all" | "score" | "missing" | "confidence";

/* ── Helpers ── */

const REASON_LABEL: Record<string, string> = {
  score: "불합격",
  missing: "미응시",
  confidence: "신뢰도 낮음",
};

const REASON_COLOR: Record<string, string> = {
  score: "var(--color-error)",
  missing: "var(--color-warning)",
  confidence: "var(--color-info, #3b82f6)",
};

function formatCycle(n?: number): string {
  if (!n || n <= 1) return "1차";
  return `${n}차`;
}

/* ══════════════════════════════════════════ */

export default function ClinicBookingsPage() {
  const qc = useQueryClient();
  const { data: targets = [], isLoading } = useClinicTargets();

  const [viewMode, setViewMode] = useState<ViewMode>("students");
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());

  /* ── Mutations ── */
  const resolveMutation = useMutation({
    mutationFn: (id: number) => resolveClinicLink(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-targets"] });
      feedback.success("해소 처리되었습니다.");
    },
    onError: () => feedback.error("해소 처리에 실패했습니다."),
  });

  const waiveMutation = useMutation({
    mutationFn: (id: number) => waiveClinicLink(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-targets"] });
      feedback.success("면제 처리되었습니다.");
    },
    onError: () => feedback.error("면제 처리에 실패했습니다."),
  });

  const carryOverMutation = useMutation({
    mutationFn: (id: number) => carryOverClinicLink(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-targets"] });
      feedback.success("다음 차수로 이월되었습니다.");
    },
    onError: () => feedback.error("이월 처리에 실패했습니다."),
  });

  const isMutating = resolveMutation.isPending || waiveMutation.isPending || carryOverMutation.isPending;

  /* ── Filtered data ── */
  const filtered = useMemo(() => {
    let list = targets;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.student_name.toLowerCase().includes(q) ||
          (t.session_title || "").toLowerCase().includes(q)
      );
    }
    if (reasonFilter !== "all") {
      list = list.filter((t) => t.reason === reasonFilter);
    }
    return list;
  }, [targets, search, reasonFilter]);

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
    // Sort: more open items first
    return Array.from(map.values()).sort((a, b) => b.openCount - a.openCount);
  }, [filtered]);

  /* ── KPI ── */
  const kpi = useMemo(() => {
    const openItems = targets.filter((t) => !t.resolved_at);
    const scoreItems = openItems.filter((t) => t.reason === "score");
    const missingItems = openItems.filter((t) => t.reason === "missing");
    const uniqueStudents = new Set(openItems.map((t) => t.enrollment_id));
    return {
      totalStudents: uniqueStudents.size,
      totalItems: openItems.length,
      scoreItems: scoreItems.length,
      missingItems: missingItems.length,
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

  /* ── Navigate to exam/session ── */
  function navigateToSource(t: ClinicTarget) {
    if (t.lecture_id && t.session_id) {
      window.open(
        `/admin/lectures/${t.lecture_id}/sessions/${t.session_id}/scores`,
        "_blank"
      );
    }
  }

  /* ══════════════════════════════════════════ */
  /* RENDER */
  /* ══════════════════════════════════════════ */

  return (
    <div className="clinic-page">
      <div className="clinic-hub">
        {/* ── KPI Row ── */}
        <div className="clinic-hub__kpi-row">
          <div className="clinic-hub__kpi clinic-hub__kpi--primary">
            <Users size={16} />
            <div>
              <span className="clinic-hub__kpi-value">{kpi.totalStudents}</span>
              <span className="clinic-hub__kpi-label">미해결 학생</span>
            </div>
          </div>
          <div className="clinic-hub__kpi clinic-hub__kpi--danger">
            <AlertTriangle size={16} />
            <div>
              <span className="clinic-hub__kpi-value">{kpi.totalItems}</span>
              <span className="clinic-hub__kpi-label">미해결 항목</span>
            </div>
          </div>
          <div className="clinic-hub__kpi">
            <FileQuestion size={16} />
            <div>
              <span className="clinic-hub__kpi-value">{kpi.scoreItems}</span>
              <span className="clinic-hub__kpi-label">시험 불합격</span>
            </div>
          </div>
          <div className="clinic-hub__kpi">
            <Clock size={16} />
            <div>
              <span className="clinic-hub__kpi-value">{kpi.missingItems}</span>
              <span className="clinic-hub__kpi-label">미응시</span>
            </div>
          </div>
        </div>

        {/* ── Toolbar: view switch + filters ── */}
        <div className="clinic-hub__toolbar">
          <div className="clinic-hub__toolbar-left">
            {/* View mode toggle */}
            <div className="clinic-hub__view-toggle">
              <button
                type="button"
                className={`clinic-hub__view-btn ${viewMode === "students" ? "clinic-hub__view-btn--active" : ""}`}
                onClick={() => setViewMode("students")}
              >
                <Users size={14} />
                학생별
              </button>
              <button
                type="button"
                className={`clinic-hub__view-btn ${viewMode === "items" ? "clinic-hub__view-btn--active" : ""}`}
                onClick={() => setViewMode("items")}
              >
                <List size={14} />
                항목별
              </button>
            </div>

            {/* Reason filter chips */}
            <div className="clinic-hub__filter-chips">
              {(["all", "score", "missing", "confidence"] as ReasonFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`clinic-hub__filter-chip ${reasonFilter === r ? "clinic-hub__filter-chip--active" : ""}`}
                  onClick={() => setReasonFilter(r)}
                >
                  {r === "all" ? "전체" : REASON_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="clinic-hub__search">
            <Search size={14} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="학생 또는 차시 검색"
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
                : "미해결 항목이 없습니다"}
            </p>
            <p className="clinic-hub__empty-desc">
              {search.trim() || reasonFilter !== "all"
                ? "필터를 변경하거나 검색어를 수정해 보세요."
                : "모든 학생이 시험/과제를 통과했습니다."}
            </p>
          </div>
        ) : viewMode === "students" ? (
          /* ═══ STUDENT VIEW ═══ */
          <div className="clinic-hub__student-list">
            {studentGroups.map((group) => {
              const isExpanded = expandedStudents.has(group.enrollmentId);
              return (
                <div
                  key={group.enrollmentId}
                  className={`clinic-hub__student-card ${isExpanded ? "clinic-hub__student-card--expanded" : ""}`}
                >
                  {/* Student header */}
                  <button
                    type="button"
                    className="clinic-hub__student-header"
                    onClick={() => toggleStudent(group.enrollmentId)}
                  >
                    <span className="clinic-hub__student-expand">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span className="clinic-hub__student-name">{group.studentName}</span>
                    <span className="clinic-hub__student-badge">
                      미해결 {group.openCount}건
                    </span>
                    {/* Reason summary chips */}
                    <div className="clinic-hub__student-reasons">
                      {group.items.slice(0, 3).map((item, idx) => (
                        <span
                          key={`${item.enrollment_id}-${item.session_title}-${idx}`}
                          className="clinic-hub__reason-chip"
                          style={{ borderColor: REASON_COLOR[item.reason ?? "score"] }}
                        >
                          {item.reason === "missing" ? (
                            <Clock size={11} />
                          ) : (
                            <FileQuestion size={11} />
                          )}
                          {item.session_title ? `${item.session_title}` : REASON_LABEL[item.reason ?? "score"]}
                        </span>
                      ))}
                      {group.items.length > 3 && (
                        <span className="clinic-hub__reason-chip clinic-hub__reason-chip--more">
                          +{group.items.length - 3}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded: item list */}
                  {isExpanded && (
                    <div className="clinic-hub__items-panel">
                      {group.items.map((item, idx) => (
                        <RemediationItemRow
                          key={`${item.enrollment_id}-${item.session_title}-${idx}`}
                          item={item}
                          onResolve={() => item.clinic_link_id && resolveMutation.mutate(item.clinic_link_id)}
                          onWaive={() => item.clinic_link_id && waiveMutation.mutate(item.clinic_link_id)}
                          onCarryOver={() => item.clinic_link_id && carryOverMutation.mutate(item.clinic_link_id)}
                          onNavigate={() => navigateToSource(item)}
                          disabled={isMutating}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ═══ ITEM VIEW (table) ═══ */
          <div className="clinic-hub__item-table-wrap">
            <table className="clinic-hub__item-table">
              <thead>
                <tr>
                  <th>학생</th>
                  <th>차시</th>
                  <th>사유</th>
                  <th>점수</th>
                  <th>차수</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={`${item.enrollment_id}-${item.session_title}-${idx}`}>
                    <td className="clinic-hub__cell-name">{item.student_name}</td>
                    <td className="clinic-hub__cell-session">{item.session_title || "-"}</td>
                    <td>
                      <span
                        className="clinic-hub__reason-badge"
                        style={{ color: REASON_COLOR[item.reason ?? "score"] }}
                      >
                        {REASON_LABEL[item.reason ?? "score"]}
                      </span>
                    </td>
                    <td className="clinic-hub__cell-score">
                      {item.reason === "missing"
                        ? "—"
                        : `${item.exam_score ?? 0}/${item.cutline_score ?? 0}`}
                    </td>
                    <td className="clinic-hub__cell-cycle">{formatCycle(item.cycle_no)}</td>
                    <td className="clinic-hub__cell-actions">
                      {item.clinic_link_id ? (
                        <div className="clinic-hub__inline-actions">
                          <button
                            type="button"
                            className="clinic-hub__action-sm clinic-hub__action-sm--resolve"
                            onClick={() => resolveMutation.mutate(item.clinic_link_id!)}
                            disabled={isMutating}
                            title="수동 해소"
                          >
                            <CheckCircle2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="clinic-hub__action-sm"
                            onClick={() => navigateToSource(item)}
                            title="원본 보기"
                          >
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="clinic-hub__cell-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ */
/* RemediationItemRow — 학생 중심 뷰의 항목 행 */
/* ══════════════════════════════════════════ */

function RemediationItemRow({
  item,
  onResolve,
  onWaive,
  onCarryOver,
  onNavigate,
  disabled,
}: {
  item: ClinicTarget;
  onResolve: () => void;
  onWaive: () => void;
  onCarryOver: () => void;
  onNavigate: () => void;
  disabled: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  const isResolved = !!item.resolved_at;
  const isMissing = item.reason === "missing";

  return (
    <div className={`clinic-hub__item-row ${isResolved ? "clinic-hub__item-row--resolved" : ""}`}>
      {/* Left: status indicator */}
      <div
        className="clinic-hub__item-indicator"
        style={{ backgroundColor: isResolved ? "var(--color-success)" : REASON_COLOR[item.reason ?? "score"] }}
      />

      {/* Center: item info */}
      <div className="clinic-hub__item-info">
        <div className="clinic-hub__item-top">
          {/* Session/lecture breadcrumb */}
          <span className="clinic-hub__item-breadcrumb">
            {item.session_title || "알 수 없는 차시"}
          </span>

          {/* Reason badge */}
          <span
            className="clinic-hub__item-reason"
            style={{ color: REASON_COLOR[item.reason ?? "score"] }}
          >
            {item.clinic_reason === "homework" ? (
              <BookOpen size={12} />
            ) : (
              <FileQuestion size={12} />
            )}
            {REASON_LABEL[item.reason ?? "score"]}
          </span>

          {/* Cycle */}
          {(item.cycle_no ?? 1) > 1 && (
            <span className="clinic-hub__item-cycle">
              {formatCycle(item.cycle_no)}
            </span>
          )}

          {/* Resolved badge */}
          {isResolved && (
            <span className="clinic-hub__item-resolved">
              <CheckCircle2 size={12} />
              해결
            </span>
          )}
        </div>

        {/* Score detail */}
        <div className="clinic-hub__item-bottom">
          {!isMissing && item.exam_score != null && item.cutline_score != null ? (
            <span className="clinic-hub__item-score">
              시험 {item.exam_score}/{item.cutline_score}점
              <span
                className="clinic-hub__score-bar"
                style={{
                  width: `${Math.min(100, (item.exam_score / Math.max(item.cutline_score, 1)) * 100)}%`,
                  backgroundColor: REASON_COLOR[item.reason ?? "score"],
                }}
              />
            </span>
          ) : isMissing ? (
            <span className="clinic-hub__item-score clinic-hub__item-score--missing">
              시험 미응시
            </span>
          ) : null}
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
              title="수동 해소"
            >
              <CheckCircle2 size={14} />
              해소
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
                  <button type="button" onClick={() => { onNavigate(); setShowActions(false); }}>
                    원본 성적 보기
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {isResolved && (
          <span className="clinic-hub__resolved-label">
            {item.resolution_type === "EXAM_PASS" ? "시험 통과"
              : item.resolution_type === "HOMEWORK_PASS" ? "과제 통과"
              : item.resolution_type === "MANUAL_OVERRIDE" ? "수동 해소"
              : item.resolution_type === "WAIVED" ? "면제"
              : "해소됨"}
          </span>
        )}
      </div>
    </div>
  );
}
