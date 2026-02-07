// src/features/dashboard/pages/DashboardPage.tsx

import useAuth from "@/features/auth/hooks/useAuth";

import { PageHeader, Section, Panel } from "@/shared/ui/ds";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="p-6">loading...</div>;

  return (
    <>
      <PageHeader title="개인 정보" />

      <Section>
        <Panel>
          <div className="panel-body space-y-2">
            <p className="text-sm text-[var(--color-text-primary)]">
              일해라... 현진...{" "}
              <span className="font-semibold">
                {user?.username}
              </span>{" "}
              님
            </p>

            <p className="text-sm text-[var(--color-text-secondary)]">
              여기에 오늘 일정, 학생·강의 현황 같은 카드형 위젯을 추가할 예정입니다.
            </p>
          </div>
        </Panel>
      </Section>
    </>
  );
}
