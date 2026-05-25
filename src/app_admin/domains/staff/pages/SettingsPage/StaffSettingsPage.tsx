// PATH: src/app_admin/domains/staff/pages/SettingsPage/StaffSettingsPage.tsx

export default function StaffSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="m-0 text-base font-bold text-[var(--color-text-primary)]">
          직원 알림톡
        </h2>
        <p className="mt-2 mb-0 text-sm text-[var(--color-text-muted)]">
          현재 직원 도메인의 자동 알림톡 트리거는 제공 중인 항목이 없습니다.
        </p>
      </div>
    </div>
  );
}
