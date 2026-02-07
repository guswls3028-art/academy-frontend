// PATH: src/features/staff/pages/StaffPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Page, PageHeader, Section } from "@/shared/ui/ds";

import StaffHeader from "../components/StaffHeader";
import StaffKpiCard from "../components/StaffKpiCard";
import { StaffTable } from "../components/StaffTable";
import StaffCreateModal from "../components/StaffCreateModal";

import { useStaffDomain } from "../hooks/useStaffDomain";
import { fetchStaffMe } from "../api/staffMe.api";

function ymLabel(from: string, to: string) {
  return `${from} ~ ${to} (이번달)`;
}

export default function StaffPage() {
  const {
    range,
    filters,
    setFilters,

    rows,
    isLoading,
    isError,

    summaries,
    ensureSummaries,
    kpis,
    refetchList,
  } = useStaffDomain();

  const meQ = useQuery({ queryKey: ["staff-me"], queryFn: fetchStaffMe });

  const [createOpen, setCreateOpen] = useState(false);

  // ✅ 현재 화면에 표시되는 rows 기준으로만 요약(summary) hydrate
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    ensureSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, range.from, range.to, filters.search, filters.is_active, filters.is_manager, filters.pay_type]);

  const canManagePayroll =
    !!meQ.data && (meQ.data.is_superuser || meQ.data.is_payroll_manager || meQ.data.is_staff);

  const rangeLabel = useMemo(() => ymLabel(range.from, range.to), [range.from, range.to]);

  // ✅ KPI: 목록에서 “이번달 운영”에 바로 필요한 것만
  const derived = useMemo(() => {
    const list = Object.values(summaries || {}).filter(Boolean) as any[];

    const needLockCount = list.filter((s) => s && !s.is_locked).length;
    const lockedCount = list.filter((s) => !!s?.is_locked).length;

    const pendingExpenseCount = list.reduce(
      (acc: number, s: any) => acc + Number(s?.pending_expense_count || 0),
      0
    );

    const totalAmount = list.reduce(
      (acc: number, s: any) => acc + Number(s?.total_amount || 0),
      0
    );

    return { needLockCount, lockedCount, pendingExpenseCount, totalAmount };
  }, [summaries]);

  if (isError) {
    return (
      <Page>
        <PageHeader title="직원 근무 · 급여 관리" description="불러오기에 실패했습니다." />
        <Section>
          <div className="text-sm text-[var(--text-muted)]">
            직원 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="직원 근무 · 급여 관리"
        description={canManagePayroll ? "관리자 모드 · 승인/월마감 가능" : "일반 모드"}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-primary"
          >
            + 직원 등록
          </button>
        }
      />

      {/* ✅ 필터/검색/새로고침: 기존 StaffHeader 재사용 */}
      <StaffHeader
        rangeLabel={rangeLabel}
        filters={filters}
        setFilters={setFilters}
        onRefresh={async () => {
          await refetchList();
          await ensureSummaries();
        }}
        onCreate={() => setCreateOpen(true)}
      />

      <Section>
        {/* ✅ KPI: “이번달 운영” 지표 */}
        <StaffKpiCard
          staffCount={kpis.staffCount}
          workHours={kpis.workHours}
          totalPay={kpis.totalPay}
          totalExpense={kpis.totalExpense}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 mt-4">
          <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
            <div className="text-xs text-[var(--text-muted)]">마감 필요</div>
            <div className="mt-1 text-lg font-semibold">{derived.needLockCount.toLocaleString()}</div>
          </div>

          <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
            <div className="text-xs text-[var(--text-muted)]">승인 대기</div>
            <div className="mt-1 text-lg font-semibold">{derived.pendingExpenseCount.toLocaleString()}</div>
          </div>

          <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
            <div className="text-xs text-[var(--text-muted)]">이번달 지급 예정</div>
            <div className="mt-1 text-lg font-semibold text-[var(--color-primary)]">
              {derived.totalAmount.toLocaleString()}원
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
            <div className="text-xs text-[var(--text-muted)]">마감 완료</div>
            <div className="mt-1 text-lg font-semibold">{derived.lockedCount.toLocaleString()}</div>
          </div>
        </div>
      </Section>

      <Section>
        {/* ✅ 핵심: StaffPage에서 대부분 작업 끝내기 */}
        <StaffTable
          staffs={rows as any[]}
          summaries={summaries as any}
          me={meQ.data as any}
          loading={isLoading || meQ.isLoading}
          onRefresh={async () => {
            await ensureSummaries();
          }}
        />
      </Section>

      <StaffCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          await refetchList();
          await ensureSummaries();
        }}
      />
    </Page>
  );
}

