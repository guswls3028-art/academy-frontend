// PATH: src/features/messages/pages/MessageLinkPage.tsx
// 카카오 연동 — PFID 입력 + 연동 가이드

import { useState, useEffect } from "react";
import { Input } from "antd";
import { Section, SectionHeader } from "@/shared/ui/ds";
import { Button } from "@/shared/ui/ds";
import { useMessagingInfo, useUpdateKakaoPfid } from "../hooks/useMessagingInfo";

export default function MessageLinkPage() {
  const { data: info } = useMessagingInfo();
  const { mutate: updatePfid, isPending } = useUpdateKakaoPfid();
  const [pfid, setPfid] = useState("");
  useEffect(() => {
    if (info?.kakao_pfid != null) setPfid(info.kakao_pfid);
  }, [info?.kakao_pfid]);

  const handleSavePfid = () => {
    const value = pfid.trim();
    if (!value) return;
    updatePfid(value);
  };

  return (
    <>
      <Section>
        <SectionHeader
          title="메시지 발신 설정"
          description="학원별 발신번호와 카카오 PFID를 설정하면 SMS·알림톡 발송이 가능합니다."
        />
        <div className="space-y-6">
          <div>
            <label
              className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
              htmlFor="messaging-sender"
            >
              발신번호 (SMS·알림톡)
            </label>
            <div className="flex gap-2 flex-wrap">
              <Input
                id="messaging-sender"
                placeholder="예: 01031217466"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                disabled={isUpdatingMessaging}
                style={{ maxWidth: 320 }}
              />
              <Button
                intent="primary"
                onClick={handleSaveSender}
                disabled={isUpdatingMessaging}
              >
                {isUpdatingMessaging ? "저장 중…" : "발신번호 저장"}
              </Button>
            </div>
            {info?.messaging_sender && (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                현재 발신번호: {info.messaging_sender}
              </p>
            )}
          </div>
          <div>
            <label
              className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
              htmlFor="kakao-pfid"
            >
              카카오 PFID (프로필 ID)
            </label>
            <div className="flex gap-2 flex-wrap">
              <Input
                id="kakao-pfid"
                placeholder="예: @xxxxx"
                value={pfid}
                onChange={(e) => setPfid(e.target.value)}
                disabled={isPending}
                style={{ maxWidth: 320 }}
              />
              <Button
                intent="primary"
                onClick={handleSavePfid}
                disabled={!pfid.trim() || isPending}
              >
                {isPending ? "저장 중…" : "연동 저장"}
              </Button>
            </div>
            {info?.kakao_pfid && (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                현재 연동된 PFID: {info.kakao_pfid}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="연동 가이드"
          description="카카오 관리자 센터에서 파트너(현진님 계정)를 등록한 뒤 PFID를 입력하세요."
        />
        <div className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-5 space-y-4 text-sm text-[var(--color-text-secondary)]">
          <ol className="list-decimal list-inside space-y-2">
            <li>카카오 비즈니스 채널을 개설하고 관리자 센터에 접속합니다.</li>
            <li>채널 관리 → 파트너 관리에서 운영 파트너(현진님 계정)를 등록합니다.</li>
            <li>연동이 완료되면 발급된 PFID(프로필 ID)를 위 입력란에 입력 후 저장합니다.</li>
            <li>마스터 템플릿이 학원 PFID로 복사·검수 신청되면 알림톡 발송을 사용할 수 있습니다.</li>
          </ol>
          <div className="pt-2 border-t border-[var(--color-border-divider)]">
            <p className="text-[var(--color-text-muted)]">
              가이드 이미지나 상세 매뉴얼은 필요 시 이 영역에 추가할 수 있습니다.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
