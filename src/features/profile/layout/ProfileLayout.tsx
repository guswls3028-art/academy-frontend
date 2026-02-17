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

/** 내 계정은 설정 탭으로 이동. 프로필은 근태·지출만 */
const PROFILE_TABS = [
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
      title="프로필"
      description="근태 기록 · 지출 내역 (내 계정은 설정 탭에서)"
      tabs={PROFILE_TABS}
    >
      <div className="max-w-[1200px] mx-auto">
        <Outlet context={ctx} />
      </div>
    </DomainLayout>
  );
}
