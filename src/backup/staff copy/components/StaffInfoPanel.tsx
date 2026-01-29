// PATH: src/features/staff/components/StaffInfoPanel.tsx
import { StaffDetail } from "../api/staff.detail.api";

export default function StaffInfoPanel({ staff }: { staff: StaffDetail }) {
  return (
    <div className="space-y-2 text-sm">
      <Item label="이름" value={staff.name} />
      <Item label="전화번호" value={staff.phone || "-"} />
      <Item label="역할" value={staff.pay_type === "MONTHLY" ? "강사" : "조교"} />
      <Item label="상태" value={staff.is_active ? "활성" : "비활성"} />
      <Item
        label="급여 타입"
        value={staff.pay_type === "HOURLY" ? "시급제" : "월급제"}
      />

      {/* ========================= */}
      {/* 🔥 계정 정보 (READ ONLY) */}
      {/* ========================= */}
      <div className="pt-2 mt-2 border-t border-[var(--border-divider)] space-y-2">
        <div className="text-xs font-semibold text-[var(--text-muted)]">
          계정 정보
        </div>

        {staff.user ? (
          <>
            <Item label="아이디" value={staff.user_username || "-"} />

            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-muted)]">권한</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  staff.user_is_staff
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {staff.user_is_staff ? "STAFF 권한" : "일반 사용자"}
              </span>
            </div>
          </>
        ) : (
          <div className="text-xs text-[var(--text-muted)] italic">
            연결된 계정 없음
          </div>
        )}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-semibold text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}
