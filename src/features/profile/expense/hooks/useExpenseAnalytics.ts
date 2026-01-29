// PATH: src/features/profile/expense/hooks/useExpenseAnalytics.ts
import { useMemo } from "react";
import { Expense } from "../../api/profile.api";

export function useExpenseAnalytics(rows: Expense[]) {
  /** 일자별 합계 */
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      map.set(r.date, (map.get(r.date) || 0) + (Number(r.amount) || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount }));
  }, [rows]);

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return {
        maxDay: null as null | { date: string; amount: number },
        avgPerDay: 0,
        overAvgDays: 0,
        top3: [] as { title: string; amount: number }[],
      };
    }

    // ✅ 일 평균(일자별 합계 기준)
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const dayCount = daily.length || 1;
    const avgPerDay = Math.round(total / dayCount);

    let maxDay: { date: string; amount: number } | null = null;
    daily.forEach((d) => {
      if (!maxDay || d.amount > maxDay.amount) maxDay = d;
    });

    const overAvgDays = daily.filter((d) => d.amount > avgPerDay).length;

    // ✅ 항목 TOP3 (title 단위로 합산)
    const titleMap = new Map<string, number>();
    rows.forEach((r) => {
      const key = (r.title || "").trim() || "기타";
      titleMap.set(key, (titleMap.get(key) || 0) + (Number(r.amount) || 0));
    });

    const top3 = Array.from(titleMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([title, amount]) => ({ title, amount }));

    return { maxDay, avgPerDay, overAvgDays, top3 };
  }, [rows, daily]);

  return { daily, stats };
}
