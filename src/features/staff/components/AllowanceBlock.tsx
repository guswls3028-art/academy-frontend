// PATH: src/features/staff/components/AllowanceBlock.tsx
// 수당 입력 구조: 고정 수당 / 시간당 수당. 현재는 비용·경비 집계 안내만 표시.
// TODO: Backend allowance API 연동 시 고정·시간제 수당 추가/수정/삭제

import "../../styles/staff-area.css";

type AllowanceItem = {
  id: string;
  name: string;
  type: "fixed" | "hourly";
  amount: number;
  hours?: number;
  note?: string;
};

type Props = {
  items?: AllowanceItem[];
  total?: number;
  /** 현재는 비용/경비(expense)가 수당으로 집계됨을 안내 */
  useExpenseAsAllowance?: boolean;
};

export function AllowanceBlock({
  items = [],
  total = 0,
  useExpenseAsAllowance = true,
}: Props) {
  return (
    <div className="staff-area staff-payroll-card">
      <div className="staff-payroll-card__title">수당</div>
      <div className="staff-payroll-card__body">
        {useExpenseAsAllowance && (
          <p className="staff-helper mb-3">
            현재 수당 · 경비는 비용/경비 메뉴에서 승인된 건이 자동 집계됩니다.
          </p>
        )}
        {items.length === 0 && !useExpenseAsAllowance && (
          <p className="staff-helper">등록된 수당이 없습니다.</p>
        )}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((a) => (
              <div key={a.id} className="staff-payroll-row">
                <span className="label">
                  {a.name}
                  {a.type === "hourly" && a.hours != null && ` · ${a.hours}h`}
                </span>
                <span className="value">
                  {a.type === "fixed"
                    ? a.amount.toLocaleString()
                    : (a.amount * (a.hours ?? 0)).toLocaleString()}
                  원
                </span>
              </div>
            ))}
            <div className="staff-payroll-row staff-payroll-row--total">
              <span className="label">수당 합계</span>
              <span className="value">{total.toLocaleString()}원</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
