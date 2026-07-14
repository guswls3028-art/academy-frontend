// PATH: src/app_teacher/domains/comms/pages/MessagingSettingsPage.tsx
// 메시지 설정 — 공용 알림톡 상태 + 자동발송. 테넌트별 공급자/키/PFID 편집은 노출하지 않는다.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { ChevronLeft, Check, AlertCircle, Send, MessageCircle, Settings, Lock, Pencil, Eye } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import {
  fetchMessagingInfo,
  fetchAutoSendConfigs, updateAutoSendConfig,
  AUTO_SEND_TRIGGER_LABELS,
  type AutoSendConfig,
} from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { InlineHelp } from "@/shared/ui/guide";
import { teacherCommsQueryKeys } from "../queryKeys";
import styles from "./MessagingSettingsPage.module.css";

function templateNameFromConfig(config: AutoSendConfig): string | undefined {
  if (config.template_name) return config.template_name;
  return typeof config.template === "object" && config.template ? config.template.name : undefined;
}

export default function MessagingSettingsPage() {
  const navigate = useNavigate();

  const { data: info, isLoading, isError, refetch } = useQuery({
    queryKey: teacherCommsQueryKeys.messagingInfo,
    queryFn: fetchMessagingInfo,
  });

  const { data: autoConfigs, isError: autoConfigsError } = useQuery({
    queryKey: teacherCommsQueryKeys.autoSendConfigs,
    queryFn: fetchAutoSendConfigs,
  });

  const alimtalkAvailable = Boolean(info?.alimtalk_available);
  const messagingDisabled = Boolean(info?.messaging_disabled);
  const readyAutoCount = (autoConfigs ?? []).filter((config) => config.effective_template_is_approved).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button type="button" onClick={() => navigate(-1)} aria-label="뒤로가기" className={`${styles.backButton} flex p-1 cursor-pointer`}>
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className={`${styles.pageTitle} text-[17px] font-bold`}>메시지 설정</h1>
      </div>

      {isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}

      {isError && (
        <EmptyState
          scope="panel"
          tone="error"
          title="메시지 설정을 불러오지 못했습니다"
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          actions={<button type="button" className={styles.secondaryButton} onClick={() => void refetch()}>다시 시도</button>}
        />
      )}

      {!isLoading && info && (
        <>
          {!alimtalkAvailable && (
            <div className={styles.setupNotice}>
              <AlertCircle size={ICON.sm} className={styles.warnIcon} />
              <div className={`${styles.setupNoticeText} text-[12px]`}>
                <strong className={styles.setupNoticeTitle}>{messagingDisabled ? "알림톡 발송이 중지되어 있습니다." : "공용 알림톡 상태를 확인해 주세요."}</strong>
                <span className={styles.setupNoticeTail}>
                  {messagingDisabled
                    ? info.messaging_disabled_reason
                    : "학원에서 키를 입력하지 않습니다. 대표·관리자가 운영 담당자에게 상태 확인을 요청해 주세요."}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <KpiStatCard icon={<Settings size={ICON.xs} />} label="공급자" value="공용 솔라피" status="ok" tone="provider" />
            <KpiStatCard icon={<MessageCircle size={ICON.xs} />} label="채널" value={messagingDisabled ? "운영 중지" : "공용 채널"} status={alimtalkAvailable ? "ok" : "warn"} statusLabel={messagingDisabled ? "중지" : undefined} tone="sender" />
            <KpiStatCard icon={<Send size={ICON.xs} />} label="알림톡" value={messagingDisabled ? "운영 중지" : alimtalkAvailable ? "사용 가능" : "확인 필요"} status={alimtalkAvailable ? "ok" : "warn"} statusLabel={messagingDisabled ? "중지" : undefined} tone="kakao" />
            <KpiStatCard icon={<Lock size={ICON.xs} />} label="발송 정책" value="알림톡 전용" status="ok" tone="sms" />
          </div>

          <Card>
            <SectionHeader icon={<Lock size={ICON.sm} />} title="공용 알림톡 정책" desc="학생·학부모 안내는 승인된 카카오 알림톡으로만 발송됩니다." badge="알림톡 전용" />
            <p className={`${styles.mutedText} text-[12px] leading-5`}>
              공급자, API 키, 발신번호와 카카오 채널은 서비스가 공용으로 관리합니다. 저장한 문구는 발송 시 승인된 알림톡 양식에 안전하게 담깁니다.
            </p>
          </Card>

          <Card>
            <SectionHeader icon={<MessageCircle size={ICON.sm} />} title="알림톡 채널" desc="공용 채널과 발송 준비 상태를 확인합니다." badge={messagingDisabled ? "운영 중지" : alimtalkAvailable ? "연결됨" : "확인 필요"} />
            <div className="flex items-center justify-between gap-2">
              <span className={`${styles.mutedText} text-[12px]`}>공용 채널 · 별도 입력 없음</span>
              <StatusChip ok={alimtalkAvailable} label={messagingDisabled ? "운영 중지" : alimtalkAvailable ? "발송 가능" : "확인 필요"} />
            </div>
            <button type="button" onClick={() => navigate("/teacher/message-templates")}
              className={`${styles.secondaryButton} w-full text-xs font-semibold cursor-pointer mt-3`}>
              알림톡 문구 관리
            </button>
          </Card>

          {Array.isArray(autoConfigs) && autoConfigs.length > 0 && (
            <Card>
              <SectionHeader icon={<Send size={ICON.sm} />} title="자동 발송" desc="승인 양식이 준비된 알림만 켤 수 있습니다." badge={`${readyAutoCount}/${autoConfigs.length} 준비`} />
              <div className="flex flex-col gap-1.5">
                {autoConfigs.map((cfg, i) => (
                  <AutoSendRow key={cfg.id ?? i} config={cfg} operationalDisabled={messagingDisabled} />
                ))}
              </div>
            </Card>
          )}
          {autoConfigsError && (
            <EmptyState scope="panel" tone="error" title="자동 발송 설정을 불러오지 못했습니다" />
          )}
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiStatCard({ icon, label, value, status, statusLabel, tone }: {
  icon: React.ReactNode; label: string; value: string; status: "ok" | "warn" | "none"; statusLabel?: string; tone: "provider" | "sender" | "kakao" | "sms";
}) {
  const toneClass = {
    provider: styles.kpiProvider,
    sender: styles.kpiSender,
    kakao: styles.kpiKakao,
    sms: styles.kpiSms,
  }[tone];
  const statusClass = {
    ok: styles.kpiStatusOk,
    warn: styles.kpiStatusWarn,
    none: styles.kpiStatusNone,
  }[status];

  return (
    <div className={styles.kpiCard}>
      <div className="flex items-center gap-1.5">
        <div className={`${styles.kpiIcon} ${toneClass}`}>{icon}</div>
        <span className={`${styles.kpiLabel} text-[11px] font-semibold`}>{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`${styles.kpiValue} text-[13px] font-bold truncate`}>{value}</span>
        {status !== "none" && (
          <span className={`${statusClass} text-[10px] font-semibold flex items-center gap-0.5`}>
            {status === "ok" ? <Check size={9} /> : <AlertCircle size={9} />}
            {statusLabel ?? (status === "ok" ? "연동" : "미설정")}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, desc, badge }: { icon: React.ReactNode; title: string; desc?: string; badge?: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5">
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={`${styles.sectionTitle} text-[14px] font-bold`}>{title}</span>
        {desc && (
          <InlineHelp
            title={`${title} 안내`}
            ariaLabel={`${title} 도움말`}
            tone="teacher"
            align="left"
            iconSize={14}
          >
            <p>{desc}</p>
          </InlineHelp>
        )}
        {badge && (
          <span className={`${styles.sectionBadge} text-[10px] font-semibold`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`${styles.statusChip} ${ok ? styles.statusChipOk : styles.statusChipWarn} text-[11px] font-semibold flex items-center gap-0.5`}>
      {ok ? <Check size={10} /> : <AlertCircle size={10} />}
      {label}
    </span>
  );
}

function AutoSendRow({ config, operationalDisabled }: { config: AutoSendConfig; operationalDisabled: boolean }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const implStatus = config.implementation_status;
  const isUnimplemented = implStatus === "manual_only" || implStatus === "disabled";
  const isSystem = config.policy_mode === "SYSTEM_AUTO";
  const templateReady = Boolean(config.effective_template_is_approved);
  const enabled = !operationalDisabled && templateReady && !isUnimplemented && (isSystem || (config.enabled ?? false));

  const toggleMut = useMutation({
    mutationFn: () => updateAutoSendConfig(config.trigger, { enabled: !enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherCommsQueryKeys.autoSendConfigs });
      teacherToast.success(!enabled ? "자동 발송을 켰습니다." : "자동 발송을 껐습니다.");
    },
  });

  const triggerKey: string = config.trigger ?? "";
  const triggerLabel = AUTO_SEND_TRIGGER_LABELS[triggerKey] || config.trigger_label || config.trigger_name || triggerKey || "트리거";
  const templateName = templateNameFromConfig(config);
  const modeLabel = "알림톡";
  const minutesBefore = config.minutes_before;

  return (
    <>
      <div className={`${styles.autoSendRow} flex items-start gap-2`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`${styles.previewValue} text-[13px] font-semibold`}>{triggerLabel}</span>
            {modeLabel && <Badge tone="neutral" size="xs">{modeLabel}</Badge>}
            {isUnimplemented && (
              <Badge tone="neutral" size="xs">
                {implStatus === "disabled" ? "비활성" : "수동 전용"}
              </Badge>
            )}
            {!templateReady && !isUnimplemented && (
              <Badge tone="warning" size="xs">발송 준비 필요</Badge>
            )}
            {operationalDisabled && <Badge tone="warning" size="xs">운영 중지</Badge>}
            {isSystem && templateReady && !operationalDisabled && <Badge tone="success" size="xs">항상 활성</Badge>}
            {minutesBefore != null && minutesBefore > 0 && (
              <Badge tone="neutral" size="xs">{minutesBefore}분 전</Badge>
            )}
          </div>
          {templateName && (
            <div className={`${styles.mutedText} text-[11px] truncate mt-0.5`}>
              템플릿: {templateName}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setEditOpen(true)} type="button"
            className={`${styles.iconButton} flex p-1 cursor-pointer`}
            title={config.template_is_system ? "내용 보기" : "설정 편집"}>
            {config.template_is_system ? <Eye size={ICON.sm} /> : <Pencil size={ICON.sm} />}
          </button>
          <button
            onClick={() => { if (!isUnimplemented) toggleMut.mutate(); }}
            type="button"
            role="switch"
            aria-label={`${triggerLabel} 자동 발송`}
            aria-checked={enabled}
            className={`${styles.toggleButton} cursor-pointer`}
            disabled={operationalDisabled || isUnimplemented || isSystem || !templateReady}
          >
            <div className={`${styles.toggleTrack} ${enabled ? styles.toggleTrackOn : ""} w-10 h-5 rounded-full relative`}>
              <div className={`${styles.toggleKnob} ${enabled ? styles.toggleKnobOn : ""} absolute top-0.5 w-4 h-4 rounded-full bg-white shadow`} />
            </div>
          </button>
        </div>
      </div>
      <AutoSendEditSheet open={editOpen} onClose={() => setEditOpen(false)} config={config} />
    </>
  );
}

/* ─── Auto Send Edit Sheet ─── */
function AutoSendEditSheet({ open, onClose, config }: { open: boolean; onClose: () => void; config: AutoSendConfig }) {
  const qc = useQueryClient();
  const [minutesBefore, setMinutesBefore] = useState<string>(
    config.minutes_before != null ? String(config.minutes_before) : ""
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMinutesBefore(config.minutes_before != null ? String(config.minutes_before) : "");
  }, [open, config]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        message_mode: "alimtalk",
        minutes_before: minutesBefore.trim() ? Number(minutesBefore) : null,
      };
      return updateAutoSendConfig(config.trigger, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherCommsQueryKeys.autoSendConfigs });
      teacherToast.success("자동 발송 설정이 저장되었습니다.");
      onClose();
    },
    onError: () => teacherToast.error("저장에 실패했습니다."),
  });

  const triggerKey: string = config.trigger ?? "";
  const triggerLabel = AUTO_SEND_TRIGGER_LABELS[triggerKey] || triggerKey;
  const templateName = templateNameFromConfig(config) || "정해진 알림톡";
  const templateBody = config.template_body || (typeof config.template === "object" && config.template ? config.template.body : "");
  const canEditTiming = config.policy_mode !== "SYSTEM_AUTO" && config.implementation_status === "implemented";
  const showMinutesBefore = triggerKey.includes("minutes_before") || triggerKey.includes("reminder") || triggerKey.includes("days_before") || triggerKey.includes("hours_before");

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={triggerLabel}>
        <div className={`${styles.sheetContent} flex flex-col gap-3`}>
          {/* 메시지 모드 */}
          <div>
            <label className={`${styles.fieldLabel} text-[11px] font-semibold block mb-1.5`}>발송 채널</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                aria-pressed="true"
                className={`${styles.channelButton} ${styles.channelButtonActive} flex-1 text-[12px] font-semibold`}
              >
                알림톡
              </button>
            </div>
          </div>

          {/* 분/시간 전 */}
          {showMinutesBefore && (
            <div>
              <label htmlFor={`auto-send-minutes-${triggerKey}`} className={`${styles.fieldLabel} text-[11px] font-semibold block mb-1`}>
                {triggerKey.includes("hours_before") ? "시간 전" : triggerKey.includes("days_before") ? "일 전" : "분 전"}
              </label>
              <input id={`auto-send-minutes-${triggerKey}`} type="number" value={minutesBefore} onChange={(e) => setMinutesBefore(e.target.value)}
                placeholder="예: 10"
                disabled={!canEditTiming}
                className={`${styles.input} w-full text-sm`} />
              <p className={`${styles.mutedText} text-[11px] mt-1`}>
                이벤트 발생 {minutesBefore || "--"} 단위 전에 자동 발송합니다.
              </p>
            </div>
          )}

          {/* 템플릿 선택 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${styles.fieldLabel} text-[11px] font-semibold`}>템플릿</label>
              {templateBody && (
                <button onClick={() => setPreviewOpen(true)} type="button"
                  className={`${styles.templatePreviewButton} flex items-center gap-0.5 text-[11px] font-semibold cursor-pointer`}>
                  <Eye size={ICON.xs} /> 미리보기
                </button>
              )}
            </div>
            <div className={`${styles.templateOption} text-left`}>
              <div className={`${styles.templateName} text-[13px] font-semibold`}>{templateName}</div>
              <div className={`${styles.mutedText} text-[11px] mt-0.5`}>
                승인된 알림톡 양식은 자동으로 연결됩니다.
              </div>
            </div>
          </div>

          {canEditTiming && (
            <button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              className={`${styles.fullSaveButton} w-full text-sm font-bold cursor-pointer mt-1`}>
              {saveMut.isPending ? "저장 중…" : "발송 시점 저장"}
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Preview */}
      {templateBody && (
        <BottomSheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="템플릿 미리보기">
          <div className={`${styles.sheetContent} flex flex-col gap-2`}>
            <div>
              <div className={`${styles.previewLabel} text-[11px]`}>이름</div>
              <div className={`${styles.previewValue} text-sm font-semibold`}>{templateName}</div>
            </div>
            <div>
              <div className={`${styles.previewLabel} text-[11px]`}>본문</div>
              <div className={`${styles.previewBody} text-[13px] mt-1`}>
                {templateBody}
              </div>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
