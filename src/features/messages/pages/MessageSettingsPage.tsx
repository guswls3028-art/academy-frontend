// PATH: src/features/messages/pages/MessageSettingsPage.tsx
// 설정 — 카카오 연동 + 메시지 연동 + 가이드 통합

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "antd";
import { FiPhone, FiMessageCircle, FiBook } from "react-icons/fi";
import { Section, Panel, Button } from "@/shared/ui/ds";
import { useMessagingInfo, useUpdateKakaoPfid } from "../hooks/useMessagingInfo";

export default function MessageSettingsPage() {
  const navigate = useNavigate();
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
    <div className="flex flex-col gap-8">
      {/* 카카오 알림톡 연동 */}
      <Panel variant="primary" title="카카오 알림톡 연동" description="학원별 PFID를 설정하면 알림톡 발송이 가능합니다.">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <FiMessageCircle size={18} style={{ color: "var(--color-primary)" }} aria-hidden />
            <span className="font-medium text-[var(--color-text-primary)]">카카오 PFID (프로필 ID)</span>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Input
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
            <p className="text-xs text-[var(--color-text-muted)]">
              현재 연동된 PFID: {info.kakao_pfid}
            </p>
          )}
        </div>
      </Panel>

      {/* 메시지 연동 (발신번호) */}
      <Panel variant="primary" title="메시지 연동" description="SMS·알림톡 발송 시 사용할 발신번호를 설정합니다.">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            발신번호는 설정 &gt; 내 정보에서 등록·인증할 수 있습니다. 솔라피에 등록된 번호만 사용할 수 있습니다.
          </p>
          <Button
            intent="secondary"
            size="sm"
            onClick={() => navigate("/admin/settings/account")}
            style={{ alignSelf: "flex-start" }}
          >
            설정 &gt; 내 정보로 이동
          </Button>
        </div>
      </Panel>

      {/* 가이드 */}
      <Panel variant="primary" title="연동 가이드" description="카카오 알림톡 및 솔라피 연동 절차입니다.">
        <div
          className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-5 space-y-4 text-sm text-[var(--color-text-secondary)]"
        >
          <ol className="list-decimal list-inside space-y-2">
            <li>카카오 비즈니스 채널을 개설하고 관리자 센터에 접속합니다.</li>
            <li>채널 관리 → 파트너 관리에서 운영 파트너(현진님 계정)를 등록합니다.</li>
            <li>연동이 완료되면 발급된 PFID(프로필 ID)를 위 입력란에 입력 후 저장합니다.</li>
            <li>설정 &gt; 내 정보에서 발신번호를 등록·인증합니다 (솔라피 연동 필요).</li>
            <li>템플릿 저장에서 양식을 만들고, 검수 신청 후 승인되면 알림톡 발송을 사용할 수 있습니다.</li>
          </ol>
          <div className="pt-2 border-t border-[var(--color-border-divider)]">
            <p className="text-[var(--color-text-muted)]">
              가이드 이미지나 상세 매뉴얼은 필요 시 이 영역에 추가할 수 있습니다.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
