// PATH: src/features/profile/layout/ProfileLayout.tsx
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { DomainLayout } from "@/shared/ui/layout";

export type DateRange = {
  from: string;
  to: string;
};

export type ProfileOutletContext = {
  month: string;
  setMonth: (v: string) => void;

  range: DateRange;
  setRange: (r: DateRange) => void;
  setRangeFrom: (v: string) => void;
  setRangeTo: (v: string) => void;

  resetRangeToMonth: (m?: string) => void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getMonthBounds(month: string): DateRange {
  const [y, m] = month.split("-").map(Number);
  const first = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${pad2(m)}-${pad2(lastDay)}`;
  return { from: first, to: last };
}

const PROFILE_TABS = [
  { key: "account", label: "내 계정", path: "/admin/profile/account" },
  { key: "attendance", label: "근태", path: "/admin/profile/attendance" },
  { key: "expense", label: "지출", path: "/admin/profile/expense" },
];

export default function ProfileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [range, setRange] = useState<DateRange>(() =>
    getMonthBounds(month)
  );

  const resetRangeToMonth = (m?: string) => {
    setRange(getMonthBounds(m ?? month));
  };

  useEffect(() => {
    setRange(getMonthBounds(month));
  }, [month]);

  const setRangeFrom = (v: string) =>
    setRange({ from: v, to: range.to });

  const setRangeTo = (v: string) =>
    setRange({ from: range.from, to: v });

  const ctx = useMemo(
    () => ({
      month,
      setMonth,
      range,
      setRange,
      setRangeFrom,
      setRangeTo,
      resetRangeToMonth,
    }),
    [month, range]
  );

  return (
    <DomainLayout
      title="내 계정"
      description="개인 정보 관리 · 근태 기록 · 지출 내역 · 대형강사 전용 통합 대시보드"
      tabs={PROFILE_TABS}
    >
      <div className="max-w-[1200px] mx-auto">
        <Outlet context={ctx} />
      </div>
    </DomainLayout>
  );
}
