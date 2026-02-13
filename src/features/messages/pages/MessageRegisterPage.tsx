// PATH: src/features/messages/pages/MessageRegisterPage.tsx
// 메시지 등록 — 학생/학부모 문자·알림 발송

import { Section, SectionHeader } from "@/shared/ui/ds";

export default function MessageRegisterPage() {
  return (
    <Section>
      <SectionHeader title="메시지 등록" />
      <p className="text-[var(--color-text-muted)] text-sm">
        학생·학부모 대상 문자 및 알림 메시지를 등록하고 발송할 수 있습니다.
      </p>
      <div className="mt-4 p-4 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--color-border-divider)]">
        <span className="text-[var(--color-text-muted)] text-sm">
          발송 대상 선택, 메시지 작성, 예약 발송 등 기능이 이곳에 구현됩니다.
        </span>
      </div>
    </Section>
  );
}
