import { useQuery } from "@tanstack/react-query";
import { fetchClinicMe } from "../../api/clinicMe.api";

export default function ClinicSettingsPage() {
  const meQ = useQuery({
    queryKey: ["clinic-me"],
    queryFn: fetchClinicMe,
  });

  const canManage = !!meQ.data?.is_payroll_manager || !!meQ.data?.is_superuser;

  if (meQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-5">
        <div className="text-sm font-semibold">권한이 없습니다.</div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          설정은 관리자만 접근 가능합니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-lg font-semibold">설정</div>
        <div className="text-xs text-[var(--text-muted)]">
          * 정책/기준/자동화 설정은 서버 단일진실로 관리됩니다.
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
          <div className="text-sm font-semibold">클리닉 정책</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            * 이 영역은 백엔드 정책 API가 준비되면 그대로 연결합니다.
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-5">
            <div className="text-sm font-semibold">예시</div>
            <div className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              - ProgressPolicy (컷라인/판정 기준)
              <br />
              - 자동 대상자 생성 on/off
              <br />
              - 예약 슬롯(시간/정원) 규칙
              <br />
              * 프론트는 “설정 UI”만 제공하고 저장/검증은 서버가 담당
            </div>
          </div>
        </div>

        <div className="px-5 pb-4">
          <div className="text-[11px] text-[var(--text-muted)]">
            * 설정은 운영 안정성을 위해 “서버 검증”이 반드시 필요합니다.
          </div>
        </div>
      </div>
    </div>
  );
}
