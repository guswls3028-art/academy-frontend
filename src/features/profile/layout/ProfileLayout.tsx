// PATH: src/features/profile/layout/ProfileLayout.tsx
import { Outlet } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader, PageTabs } from "@/shared/ui/page";

export type DateRange = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

export type ProfileOutletContext = {
  month: string;
  setMonth: (v: string) => void;

  range: DateRange;
  setRange: (r: DateRange) => void;
  setRangeFrom: (v: string) => void;
  setRangeTo: (v: string) => void;

  /** 월 기준으로 기간을 전체(1일~말일)로 리셋 */
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

function clampRange(r: DateRange): DateRange {
  if (!r.from) return r;
  if (!r.to) return r;
  return r.from <= r.to ? r : { from: r.to, to: r.from };
}

export default function ProfileLayout() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [range, setRangeState] = useState<DateRange>(() =>
    getMonthBounds(month)
  );

  const resetRangeToMonth = (m?: string) => {
    const mm = m ?? month;
    setRangeState(getMonthBounds(mm));
  };

  useEffect(() => {
    setRangeState(getMonthBounds(month));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const setRange = (r: DateRange) => {
    const next = clampRange(r);

    if (next.from?.slice(0, 7) && next.from.slice(0, 7) !== month) {
      setMonth(next.from.slice(0, 7));
      setRangeState(next);
      return;
    }
    setRangeState(next);
  };

  const setRangeFrom = (v: string) => setRange({ from: v, to: range.to });
  const setRangeTo = (v: string) => setRange({ from: range.from, to: v });

  const ctx = useMemo<ProfileOutletContext>(
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
    <Page>
      <PageHeader
        title="사용자 정보"
        description="내 정보 / 근태 / 지출을 관리합니다."
      />

      <PageTabs
        tabs={[
          { label: "내 정보", to: "account", end: true },
          { label: "근태", to: "attendance" },
          { label: "지출", to: "expense" },
        ]}
      />

      {/* ✅ Profile 전용 작업 영역 */}
      <div className="profile-page-wrap">
        <Outlet context={ctx} />
      </div>

      {/* ✅ 레이아웃 핵심: 페이지 폭 제어 */}
      <style>{`
        .profile-page-wrap {
          max-width: 1100px;
          padding-right: 24px;
          padding-left: 0;
        }

        @media (max-width: 1280px) {
          .profile-page-wrap {
            max-width: 100%;
            padding-right: 16px;
          }
        }
      `}</style>
    </Page>
  );
}
