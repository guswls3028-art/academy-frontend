// PATH: src/features/profile/layout/ProfileLayout.tsx
import { Outlet } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/shared/ui/ds";

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

export default function ProfileLayout() {
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
    <>
      <PageHeader title="사용자 정보" />

      <div className="max-w-[1100px] px-6">
        <Outlet context={ctx} />
      </div>
    </>
  );
}
