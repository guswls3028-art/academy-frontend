// PATH: src/features/messages/pages/MessageGuidePage.tsx
// 메시지 기능 가이드

import { Section, SectionHeader } from "@/shared/ui/ds";

export default function MessageGuidePage() {
  return (
    <Section>
      <SectionHeader title="가이드 확인" />
      <p className="text-[var(--color-text-muted)] text-sm">
        메시지 등록·발송 방법과 정책 안내를 확인할 수 있습니다.
      </p>
      <div className="mt-4 p-4 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--color-border-divider)] space-y-3 text-sm text-[var(--color-text-secondary)]">
        <p>· 메시지 등록: 대상 선택 후 내용 작성 및 발송</p>
        <p>· 로그: 발송 이력 및 수신 상태 조회</p>
        <p>· 문자/알림 정책 및 이용 안내</p>
      </div>
    </Section>
  );
}
