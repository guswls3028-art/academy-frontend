// PATH: src/features/staff/pages/HomePage/HomeKpiSection.tsx
import React from "react";
import ActionButton from "../../components/ActionButton";
import { useNavigate } from "react-router-dom";

export const HomeKpiSection: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const nav = useNavigate();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-4">
        <div className="text-sm font-semibold">운영 규칙</div>
        <div className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
          • 합계/급여/시간/상태 판정: <b>백엔드 단일진실</b> <br />
          • <b>월 마감 = 급여 확정</b> · 마감된 월은 변경 불가 <br />
          • 승인/마감: <b>관리자(is_payroll_manager)</b>만 가능
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-4">
        <div className="text-sm font-semibold">빠른 작업</div>
        <div className="text-xs text-[var(--text-muted)] mt-2">
          근태·비용/경비·월 마감은 각 탭에서 처리합니다.
        </div>

        <div className="mt-3 flex items-center gap-2">
          <ActionButton
            variant="primary"
            size="sm"
            onClick={() => nav("/admin/staff/attendance")}
          >
            근태 탭
          </ActionButton>

          <ActionButton
            variant="outline"
            size="sm"
            onClick={() => nav("/admin/staff/reports")}
          >
            리포트/명세
          </ActionButton>
        </div>

        {!canManage && (
          <div className="mt-2 text-[11px] text-[var(--color-danger)]">
            * 현재 계정은 승인/마감 권한이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};
