// PATH: src/features/clinic/components/bookings/ClinicTargetTable.tsx
// 예약 대상자 목록 — 단일 컬럼 레이아웃용
// Phase 8: 미예약 우선 정렬, 빈 상태 개선

import { Checkbox, Input, Tag } from "antd";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useClinicTargets } from "../../hooks/useClinicTargets";

const REASON_LABEL: Record<string, string> = {
  exam: "시험 불합",
  homework: "과제 불합",
  both: "시험·과제 불합",
};

export default function ClinicTargetTable({
  selected,
  onChangeSelected,
  bookedEnrollmentIds,
  unbookedEnrollmentIds,
}: {
  selected: number[];
  onChangeSelected: (v: number[]) => void;
  bookedEnrollmentIds?: Set<number>;
  unbookedEnrollmentIds?: number[];
}) {
  const { data = [], isLoading } = useClinicTargets();
  const [q, setQ] = useState("");

  // Phase 8: 미예약 우선 정렬
  const unbookedSet = useMemo(
    () => new Set(unbookedEnrollmentIds ?? []),
    [unbookedEnrollmentIds]
  );

  const rows = useMemo(() => {
    let filtered = data;
    if (q.trim()) {
      filtered = data.filter(
        (r) =>
          r.student_name.includes(q) || String(r.enrollment_id).includes(q)
      );
    }
    // Sort: unbooked first
    return [...filtered].sort((a, b) => {
      const aUnbooked = unbookedSet.has(a.enrollment_id) ? 0 : 1;
      const bUnbooked = unbookedSet.has(b.enrollment_id) ? 0 : 1;
      return aUnbooked - bUnbooked;
    });
  }, [data, q, unbookedSet]);

  const allChecked =
    rows.length > 0 && rows.every((r) => selected.includes(r.enrollment_id));

  return (
    <div className="clinic-bookings__targets">
      {/* Header */}
      <div className="clinic-bookings__targets-header">
        <h3 className="clinic-bookings__targets-title">클리닉 대상 학생</h3>
        <div className="clinic-bookings__targets-search">
          <Search size={14} className="clinic-bookings__targets-search-icon" />
          <Input
            placeholder="이름으로 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="clinic-bookings__targets-search-input"
            variant="borderless"
          />
        </div>
      </div>

      {/* Select all bar */}
      <div className="clinic-bookings__targets-selectbar">
        <Checkbox
          checked={allChecked}
          onChange={() =>
            onChangeSelected(allChecked ? [] : rows.map((r) => r.enrollment_id))
          }
        >
          전체 선택
        </Checkbox>
        <span className="clinic-bookings__targets-count">
          {selected.length}명 선택
        </span>
      </div>

      {/* List */}
      <div className="clinic-bookings__targets-list">
        {isLoading && (
          <div className="ds-section__empty py-10">불러오는 중…</div>
        )}
        {/* Phase 8: 빈 상태 개선 */}
        {!isLoading && rows.length === 0 && (
          <div className="clinic-bookings__targets-empty">
            <p className="clinic-bookings__targets-empty-title">
              {q.trim()
                ? `"${q}" 검색 결과가 없습니다.`
                : "이번 주 클리닉 대상 학생이 없습니다."}
            </p>
            {!q.trim() && (
              <p className="clinic-bookings__targets-empty-desc">
                시험이나 과제에서 미통과한 학생이 자동으로 표시됩니다.
              </p>
            )}
          </div>
        )}
        {rows.map((r) => {
          const isBooked = bookedEnrollmentIds?.has(r.enrollment_id) ?? false;
          const reasonLabel = r.clinic_reason
            ? REASON_LABEL[r.clinic_reason] ?? r.clinic_reason
            : undefined;

          return (
            <label
              key={r.enrollment_id}
              className="clinic-bookings__target-row"
            >
              <Checkbox
                checked={selected.includes(r.enrollment_id)}
                onChange={(e) =>
                  onChangeSelected(
                    e.target.checked
                      ? [...selected, r.enrollment_id]
                      : selected.filter((id) => id !== r.enrollment_id)
                  )
                }
              />
              <div className="clinic-bookings__target-info">
                <span className="clinic-bookings__target-name">
                  {r.student_name}
                </span>
                <div className="clinic-bookings__target-detail">
                  {r.session_title && (
                    <span className="clinic-target__session">
                      {r.session_title}
                    </span>
                  )}
                  {r.exam_score != null && r.cutline_score != null && (
                    <span className="clinic-target__score">
                      시험 {r.exam_score}/{r.cutline_score}점
                    </span>
                  )}
                  {r.homework_score != null && r.homework_cutline != null && (
                    <span className="clinic-target__score">
                      과제 {r.homework_score}/{r.homework_cutline}점
                    </span>
                  )}
                </div>
                {reasonLabel && (
                  <Tag
                    color={r.clinic_reason === "both" ? "red" : "orange"}
                    className="clinic-bookings__target-reason"
                  >
                    {reasonLabel}
                  </Tag>
                )}
              </div>
              <span
                className={`clinic-bookings__target-status ${
                  isBooked
                    ? "clinic-bookings__target-status--booked"
                    : "clinic-bookings__target-status--unbooked"
                }`}
              >
                {isBooked ? "예약됨" : "미예약"}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
