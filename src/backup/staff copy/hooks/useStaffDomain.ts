// PATH: src/features/staff/hooks/useStaffDomain.ts
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchStaffs,
  fetchStaffSummary,
  Staff,
  StaffSummary,
} from "../api/staff.api";

export type StaffFilters = {
  search: string;
  is_active: "ALL" | "ACTIVE" | "INACTIVE";
  is_manager: "ALL" | "MANAGER" | "STAFF";
  pay_type: "ALL" | "HOURLY" | "MONTHLY";
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthBoundsFrom(dateISO: string) {
  const y = Number(dateISO.slice(0, 4));
  const m = Number(dateISO.slice(5, 7));
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function toStaffListParams(filters: StaffFilters) {
  // ✅ 백엔드 단일진실: 리스트 필터/검색은 서버에서 수행
  const params: any = {};

  const q = filters.search.trim();
  if (q) params.search = q;

  if (filters.is_active !== "ALL") params.is_active = filters.is_active === "ACTIVE";
  if (filters.is_manager !== "ALL") params.is_manager = filters.is_manager === "MANAGER";
  if (filters.pay_type !== "ALL") params.pay_type = filters.pay_type;

  return params;
}

export function useStaffDomain() {
  const [filters, setFilters] = useState<StaffFilters>({
    search: "",
    is_active: "ALL",
    is_manager: "ALL",
    pay_type: "ALL",
  });

  const [baseDate] = useState(() => todayISO());
  const range = useMemo(() => getMonthBoundsFrom(baseDate), [baseDate]);

  const listParams = useMemo(() => toStaffListParams(filters), [filters]);

  const listQ = useQuery({
    queryKey: ["staffs", listParams],
    queryFn: () => fetchStaffs(listParams),
    staleTime: 10_000,
  });

  const rows = (listQ.data ?? []) as Staff[];

  const [summaries, setSummaries] = useState<Record<number, StaffSummary | undefined>>({});

  const hydrateSummaries = async (staffs: Staff[]) => {
    // ✅ 현재 화면의 rows 기준으로만 summary 당김 (필터 반영)
    const entries = await Promise.all(
      staffs.map(async (s) => {
        try {
          const sum = await fetchStaffSummary(s.id, {
            date_from: range.from,
            date_to: range.to,
          });
          return [s.id, sum] as const;
        } catch {
          return [s.id, undefined] as const;
        }
      })
    );

    const next: Record<number, StaffSummary | undefined> = {};
    entries.forEach(([id, sum]) => (next[id] = sum));
    setSummaries(next);
  };

  const ensureSummaries = async () => {
    const staffs = (listQ.data ?? []) as Staff[];
    if (!staffs.length) {
      setSummaries({});
      return;
    }
    await hydrateSummaries(staffs);
  };

  const kpis = useMemo(() => {
    const list = Object.values(summaries).filter(Boolean) as StaffSummary[];
    const staffCount = rows.length;

    const workHours = list.reduce((s, x) => s + Number(x.work_hours || 0), 0);
    const totalPay = list.reduce((s, x) => s + Number(x.work_amount || 0), 0);
    const totalExpense = list.reduce((s, x) => s + Number(x.expense_amount || 0), 0);

    return {
      staffCount,
      workHours: Math.round(workHours * 100) / 100,
      totalPay,
      totalExpense,
    };
  }, [summaries, rows.length]);

  return {
    range,
    filters,
    setFilters,

    rows,
    isLoading: listQ.isLoading,
    isError: listQ.isError,

    summaries,
    ensureSummaries,

    kpis,
    refetchList: () => listQ.refetch(),
  };
}
