// PATH: src/features/staff/pages/OperationsPage/StaffOperationTable.tsx
import { useMemo, useState } from "react";
import { useStaffs } from "../../hooks/useStaffs";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Staff } from "../../api/staff.api";
import { Input } from "antd";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function payLabel(v: Staff["pay_type"]) {
  return v === "HOURLY" ? "시급" : "월급";
}

export default function StaffOperationTable({
  selectedStaffId,
}: {
  selectedStaffId?: number;
}) {
  const { data, isLoading } = useStaffs();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");

  /**
   * 🔒 안정성 보장
   * - dataSource 는 반드시 배열이어야 함
   */
  const staffs: Staff[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.results)
    ? (data as any).results
    : [];

  // ✅ UX: 검색은 “필터링(선택)”이며 계산/추론이 아님
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return staffs;

    return staffs.filter((s) => {
      const name = (s.name ?? "").toLowerCase();
      const phone = (s.phone ?? "").toLowerCase();
      return name.includes(needle) || phone.includes(needle);
    });
  }, [staffs, q]);

  const active = filtered.filter((s) => s.is_active);
  const inactive = filtered.filter((s) => !s.is_active);

  const pick = (id: number) => {
    params.set("staffId", String(id));
    navigate(`/admin/staff/operations?${params.toString()}`);
  };

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름/전화번호 검색"
        allowClear
        size="middle"
      />

      {isLoading && (
        <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
          불러오는 중...
        </div>
      )}

      {!isLoading && staffs.length === 0 && (
        <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-3">
          <div className="text-sm font-semibold">직원 없음</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            직원이 등록되어야 작업 콘솔을 사용할 수 있습니다.
          </div>
        </div>
      )}

      {!isLoading && staffs.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-3">
          <div className="text-sm font-semibold">검색 결과 없음</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            이름 또는 전화번호로 다시 검색해보세요.
          </div>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-4">
          <Section
            title={`활성 (${active.length})`}
            hint="현재 근무/비용 입력 대상"
            emptyText="활성 직원이 없습니다."
          >
            {active.map((s) => (
              <Row
                key={s.id}
                staff={s}
                selected={s.id === selectedStaffId}
                onClick={() => pick(s.id)}
              />
            ))}
          </Section>

          <Section
            title={`비활성 (${inactive.length})`}
            hint="선택은 가능하지만 운영 정책에 맞게 사용"
            emptyText="비활성 직원이 없습니다."
          >
            {inactive.map((s) => (
              <Row
                key={s.id}
                staff={s}
                selected={s.id === selectedStaffId}
                onClick={() => pick(s.id)}
              />
            ))}
          </Section>
        </div>
      )}

      <div className="text-[11px] text-[var(--text-muted)]">
        * 선택된 직원은 우측 작업 콘솔에 즉시 반영됩니다.
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  emptyText,
  children,
}: {
  title: string;
  hint?: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasItems = !!children && Array.isArray(children) ? children.length > 0 : true;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div className="text-xs font-semibold text-[var(--text-primary)]">{title}</div>
        {!!hint && <div className="text-[11px] text-[var(--text-muted)]">{hint}</div>}
      </div>

      {!hasItems ? (
        <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function Row({
  staff,
  selected,
  onClick,
}: {
  staff: Staff;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full text-left rounded-xl border px-4 py-3 transition",
        "focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]",
        selected
          ? "border-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] bg-[var(--color-primary-soft)]"
          : "border-[var(--border-divider)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-soft)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold truncate">{staff.name}</div>
            {!staff.is_active && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-[var(--border-divider)] text-[var(--text-muted)] bg-[var(--bg-surface-muted)]">
                비활성
              </span>
            )}
            {staff.is_manager && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] text-[var(--color-primary)] bg-[var(--color-primary-soft)]">
                관리자
              </span>
            )}
          </div>

          <div className="text-xs text-[var(--text-muted)] mt-1 truncate">
            {staff.phone || "-"}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-[var(--text-muted)]">급여</div>
          <div className="text-sm font-semibold">{payLabel(staff.pay_type)}</div>
        </div>
      </div>
    </button>
  );
}
