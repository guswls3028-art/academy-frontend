// PATH: src/app_teacher/domains/comms/pages/MessagingSettingsPage.tsx
// 메시지 설정 — 공급자 선택 + 자체 API 키 + 발신번호 + 알림톡 + 연동 테스트 + 자동발송
// 데스크탑 MessageSettingsPage와 정보 구조·설정 흐름을 일치시킨 모바일 버전
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { ChevronLeft, Check, AlertCircle, Phone, Send, MessageCircle, Settings, CheckCircle, Lock, Pencil, Eye } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import {
  fetchMessagingInfo, updateMessagingInfo, verifySender, testCredentials,
  fetchAutoSendConfigs, updateAutoSendConfig, fetchAllTemplates,
  AUTO_SEND_TRIGGER_LABELS,
  type AutoSendConfig, type MessagingProvider, type TestCredentialsResult,
} from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { useConfirm } from "@/shared/ui/confirm";
import styles from "./MessagingSettingsPage.module.css";

const SERVER_IP = "43.201.119.172";

function getErrorDetail(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

function templateIdFromConfig(config: AutoSendConfig): number | null {
  if (typeof config.template === "number") return config.template;
  return config.template?.id ?? config.template_id ?? null;
}

function templateNameFromConfig(config: AutoSendConfig): string | undefined {
  if (config.template_name) return config.template_name;
  return typeof config.template === "object" && config.template ? config.template.name : undefined;
}

export default function MessagingSettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: info, isLoading } = useQuery({
    queryKey: ["teacher-messaging-info"],
    queryFn: fetchMessagingInfo,
  });

  const { data: autoConfigs } = useQuery({
    queryKey: ["teacher-auto-send-configs"],
    queryFn: fetchAutoSendConfigs,
  });

  const [provider, setProvider] = useState<MessagingProvider>("solapi");
  const [sender, setSender] = useState("");
  const [pfid, setPfid] = useState("");
  const [ownSolapiKey, setOwnSolapiKey] = useState("");
  const [ownSolapiSecret, setOwnSolapiSecret] = useState("");
  const [ownPpurioKey, setOwnPpurioKey] = useState("");
  const [ownPpurioAccount, setOwnPpurioAccount] = useState("");
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testResult, setTestResult] = useState<TestCredentialsResult | null>(null);

  useEffect(() => { if (info?.messaging_provider) setProvider(info.messaging_provider); }, [info?.messaging_provider]);
  useEffect(() => { setSender(info?.messaging_sender ?? ""); }, [info?.messaging_sender]);
  useEffect(() => { setPfid(info?.kakao_pfid ?? ""); }, [info?.kakao_pfid]);
  useEffect(() => { setOwnPpurioAccount(info?.own_ppurio_account ?? ""); }, [info?.own_ppurio_account]);

  const updateMut = useMutation({
    mutationFn: (payload: Parameters<typeof updateMessagingInfo>[0]) => updateMessagingInfo(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-messaging-info"] }),
  });

  const verifyMut = useMutation({
    mutationFn: (phone: string) => verifySender(phone),
    onSuccess: (data) => setVerifyMsg({ ok: data.verified, msg: data.message }),
    onError: (err: unknown) => setVerifyMsg({ ok: false, msg: getErrorDetail(err, "인증 확인에 실패했습니다.") }),
  });

  const testMut = useMutation({
    mutationFn: testCredentials,
    onSuccess: (data) => {
      setTestResult(data);
      if (data.all_ok) teacherToast.success("모든 연동이 정상입니다.");
      else teacherToast.error("일부 설정을 확인해 주세요.");
    },
    onError: () => teacherToast.error("연동 테스트에 실패했습니다."),
  });

  const hasPfid = !!info?.kakao_pfid;
  const hasSender = !!info?.messaging_sender;
  const hasProviderAccess = !!info?.sms_allowed || (info?.has_own_credentials ?? false);
  const hasOwnCreds = info?.has_own_credentials ?? false;
  const providerLabel = provider === "ppurio" ? "뿌리오" : "솔라피";

  const setupSteps = [
    { done: hasProviderAccess, label: "발송 연동" },
    { done: hasSender, label: "발신번호" },
    { done: hasPfid, label: "알림톡 채널" },
  ];
  const allSetupDone = setupSteps.every((s) => s.done);

  const handleChangeProvider = (next: MessagingProvider) => {
    if (next === provider) return;
    const label = next === "ppurio" ? "뿌리오" : "솔라피";
    confirm({
      title: "메시지 공급자 변경",
      message: `메시지 공급자를 ${label}(으)로 변경하시겠습니까?`,
      confirmText: "변경",
      cancelText: "취소",
    }).then((ok) => {
      if (!ok) return;
      setProvider(next);
      updateMut.mutate({ messaging_provider: next }, {
        onSuccess: () => teacherToast.success(`${label}(으)로 변경되었습니다.`),
        onError: () => teacherToast.error("변경에 실패했습니다."),
      });
    });
  };

  const handleSaveOwnCreds = () => {
    const payload: Record<string, string> = {};
    if (provider === "solapi") {
      if (ownSolapiKey) payload.own_solapi_api_key = ownSolapiKey;
      if (ownSolapiSecret) payload.own_solapi_api_secret = ownSolapiSecret;
    } else {
      if (ownPpurioKey) payload.own_ppurio_api_key = ownPpurioKey;
      if (ownPpurioAccount) payload.own_ppurio_account = ownPpurioAccount;
    }
    if (Object.keys(payload).length === 0) { teacherToast.error("입력값을 확인해 주세요."); return; }
    updateMut.mutate(payload, {
      onSuccess: () => {
        teacherToast.success("연동 정보가 저장되었습니다.");
        setOwnSolapiKey(""); setOwnSolapiSecret(""); setOwnPpurioKey("");
      },
      onError: () => teacherToast.error("저장에 실패했습니다."),
    });
  };

  const handleClearOwnCreds = () => {
    confirm({
      title: "연동 정보 초기화",
      message: "자체 연동 정보를 초기화하시겠습니까?",
      confirmText: "초기화",
      cancelText: "취소",
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      updateMut.mutate(
        { own_solapi_api_key: "", own_solapi_api_secret: "", own_ppurio_api_key: "", own_ppurio_account: "" },
        {
          onSuccess: () => {
            teacherToast.success("연동 정보가 초기화되었습니다.");
            setOwnSolapiKey(""); setOwnSolapiSecret(""); setOwnPpurioKey(""); setOwnPpurioAccount("");
          },
          onError: () => teacherToast.error("초기화에 실패했습니다."),
        },
      );
    });
  };

  const handleVerifySender = () => {
    const v = sender.replace(/-/g, "").trim();
    if (!v) { setVerifyMsg({ ok: false, msg: "발신번호를 입력해 주세요." }); return; }
    setVerifyMsg(null);
    verifyMut.mutate(v);
  };

  const handleSaveSender = () => {
    const v = sender.replace(/-/g, "").trim();
    if (!v) return;
    updateMut.mutate({ messaging_sender: v }, {
      onSuccess: () => { teacherToast.success("발신번호가 저장되었습니다."); setVerifyMsg(null); },
      onError: () => teacherToast.error("발신번호 저장에 실패했습니다."),
    });
  };

  const handleSavePfid = () => {
    const v = pfid.trim();
    if (!v) return;
    updateMut.mutate({ kakao_pfid: v }, {
      onSuccess: () => teacherToast.success("알림톡 채널이 저장되었습니다."),
      onError: () => teacherToast.error("저장에 실패했습니다."),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button type="button" onClick={() => navigate(-1)} className={`${styles.backButton} flex p-1 cursor-pointer`}>
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className={`${styles.pageTitle} text-[17px] font-bold`}>메시지 설정</h1>
      </div>

      {isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}

      {!isLoading && info && (
        <>
          {/* 설정 완료 안내 */}
          {!allSetupDone && (
            <div className={styles.setupNotice}>
              <AlertCircle size={ICON.sm} className={styles.warnIcon} />
              <div className={`${styles.setupNoticeText} text-[12px]`}>
                <strong className={styles.setupNoticeTitle}>메시지 발송 설정을 완료해 주세요.</strong>
                <span className={styles.setupNoticeTail}>
                  {setupSteps.filter((s) => !s.done).map((s) => s.label).join(", ")} 설정이 필요합니다.
                </span>
              </div>
            </div>
          )}

          {/* KPI 요약 — 2x2 */}
          <div className="grid grid-cols-2 gap-2">
            <KpiStatCard icon={<Settings size={ICON.xs} />} label="공급자" value={providerLabel} status={hasProviderAccess ? "ok" : "warn"} tone="provider" />
            <KpiStatCard icon={<Phone size={ICON.xs} />} label="발신번호" value={info.messaging_sender || "미등록"} status={hasSender ? "ok" : "warn"} tone="sender" />
            <KpiStatCard icon={<Send size={ICON.xs} />} label="알림톡" value={hasPfid ? "사용 가능" : "미설정"} status={hasPfid ? "ok" : "none"} tone="kakao" />
            <KpiStatCard icon={<MessageCircle size={ICON.xs} />} label="자동발송" value="알림톡 전용" status={hasPfid ? "ok" : "warn"} tone="sms" />
          </div>

          {/* 잔액 (보조 정보) */}
          {info.balance != null && (
            <div className={`${styles.balanceText} text-[12px] text-center`}>
              잔액: <span className={styles.balanceAmount}>{info.balance.toLocaleString()}원</span>
              {info.alimtalk_price != null ? ` · 알림톡 ${info.alimtalk_price}원` : ""}
            </div>
          )}

          {/* ① 공급자 선택 */}
          <Card>
            <SectionHeader icon={<Settings size={ICON.sm} />} title="메시지 공급자" desc="알림톡 발송에 사용할 공급자를 선택하세요." />
            <div className={`${styles.segmentControl} flex gap-0 rounded-lg overflow-hidden`}>
              {([
                { k: "solapi" as const, l: "솔라피(Solapi)" },
                { k: "ppurio" as const, l: "뿌리오(Ppurio)" },
              ]).map((opt) => (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => handleChangeProvider(opt.k)}
                  className={`${styles.segmentButton} ${provider === opt.k ? styles.segmentButtonActive : ""} flex-1 text-[13px] font-bold cursor-pointer`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </Card>

          {/* ② API 키 등록 */}
          <Card>
            <SectionHeader icon={<Lock size={ICON.sm} />} title="API 연동 설정" desc={provider === "solapi"
              ? "솔라피 콘솔에서 발급받은 API Key/Secret을 입력하세요."
              : "뿌리오 계정 ID와 API 인증키를 입력하세요. (연동 IP: " + SERVER_IP + ")"} />

            {provider === "solapi" ? (
              <div className="flex flex-col gap-2">
                <InputField label="API Key" value={ownSolapiKey} onChange={setOwnSolapiKey}
                  placeholder={info.own_solapi_api_key ? `현재: ${info.own_solapi_api_key}` : "API Key"} />
                <InputField label="API Secret" value={ownSolapiSecret} onChange={setOwnSolapiSecret}
                  placeholder={info.own_solapi_api_secret ? `현재: ${info.own_solapi_api_secret}` : "API Secret"} type="password" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <InputField label="계정 ID (뿌리오 로그인 아이디)" value={ownPpurioAccount} onChange={setOwnPpurioAccount}
                  placeholder={info.own_ppurio_account ? `현재: ${info.own_ppurio_account}` : "예: myacademy"} />
                <InputField label="API 인증키" value={ownPpurioKey} onChange={setOwnPpurioKey}
                  placeholder={info.own_ppurio_api_key ? "현재 인증키가 저장되어 있습니다" : "뿌리오 연동개발 API 인증키"} type="password" />
                <p className={`${styles.mutedText} text-[11px] mt-0.5`}>
                  뿌리오 [연동] → [연동관리] 에서 연동 IP <code className={styles.inlineCode}>{SERVER_IP}</code> 를 반드시 등록하세요.
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              <button type="button" onClick={handleSaveOwnCreds} disabled={updateMut.isPending}
                className={`${styles.primaryButton} text-xs font-bold cursor-pointer`}>
                {updateMut.isPending ? "저장 중…" : "저장"}
              </button>
              {hasOwnCreds && (
                <button type="button" onClick={handleClearOwnCreds} disabled={updateMut.isPending}
                  className={`${styles.secondaryButton} text-xs font-semibold cursor-pointer`}>
                  초기화
                </button>
              )}
              {hasOwnCreds && <StatusChip ok label="연동됨" />}
            </div>
          </Card>

          {/* ③ 발신번호 */}
          <Card>
            <SectionHeader icon={<Phone size={ICON.sm} />} title="발신번호" desc={`${providerLabel}에 등록된 발신번호를 입력하세요.`} />
            <div className="flex flex-col gap-2">
              <input type="tel" value={sender} onChange={(e) => { setSender(e.target.value); setVerifyMsg(null); }}
                placeholder="예: 01012345678"
                className={`${styles.input} w-full text-sm`} />
              <div className="flex gap-2 flex-wrap">
                {provider === "solapi" && (
                  <button type="button" onClick={handleVerifySender} disabled={!sender.trim() || verifyMut.isPending}
                    className={`${styles.secondaryButton} text-xs font-semibold cursor-pointer`}>
                    {verifyMut.isPending ? "확인 중…" : "인증 확인"}
                  </button>
                )}
                <button type="button" onClick={handleSaveSender} disabled={!sender.trim() || updateMut.isPending}
                  className={`${styles.primaryButton} text-xs font-bold cursor-pointer`}>
                  {updateMut.isPending ? "저장 중…" : "저장"}
                </button>
              </div>
              {verifyMsg && (
                <p className={`${styles.statusMessage} ${verifyMsg.ok ? styles.statusMessageOk : styles.statusMessageError} text-[12px] font-semibold flex items-center gap-1`}>
                  {verifyMsg.ok ? <Check size={ICON.xs} /> : <AlertCircle size={ICON.xs} />}
                  {verifyMsg.msg}
                </p>
              )}
            </div>
          </Card>

          {/* ④ 카카오 알림톡 */}
          <Card>
            <SectionHeader icon={<MessageCircle size={ICON.sm} />} title="카카오 알림톡 채널" desc={hasPfid
              ? "알림톡 채널이 연동되어 있습니다."
              : "자동 발송과 학생·학부모 알림톡 전송에 필요합니다."} badge="필수" />
            <div className="flex gap-2 flex-wrap">
              <input type="text" value={pfid} onChange={(e) => setPfid(e.target.value)}
                placeholder="예: @yourChannel"
                className={`${styles.input} ${styles.pfidInput} flex-1 text-sm`} />
              <button type="button" onClick={handleSavePfid} disabled={!pfid.trim() || updateMut.isPending}
                className={`${styles.primaryButton} text-xs font-bold cursor-pointer shrink-0`}>
                {updateMut.isPending ? "저장 중…" : "저장"}
              </button>
            </div>
            {hasPfid && (
              <div className="flex items-center gap-2 mt-2">
                <StatusChip ok label="연동됨" />
                <span className={`${styles.mutedText} text-[11px]`}>
                  현재 PFID: <code className={styles.inlineCode}>{info.kakao_pfid}</code>
                </span>
              </div>
            )}
          </Card>

          {/* ⑤ 연동 테스트 */}
          <Card>
            <SectionHeader icon={<CheckCircle size={ICON.sm} />} title="연동 테스트" desc="설정이 끝났다면 아래 버튼으로 연동 상태를 확인하세요." />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => { setTestResult(null); testMut.mutate(); }}
                disabled={testMut.isPending}
                className={`${styles.primaryButton} text-xs font-bold cursor-pointer`}
              >
                {testMut.isPending ? "테스트 중…" : "연동 상태 테스트"}
              </button>
              {testResult && <StatusChip ok={testResult.all_ok} label={testResult.all_ok ? "모두 정상" : "확인 필요"} />}
            </div>
            {testResult && (
              <div className="flex flex-col gap-1.5 mt-2.5">
                {testResult.checks.map((c, i) => (
                  <div key={i} className={`${styles.testCheckRow} ${c.ok ? styles.testCheckRowOk : styles.testCheckRowError} flex items-start gap-2`}>
                    {c.ok
                      ? <CheckCircle size={ICON.sm} className={`${styles.testCheckIcon} ${styles.testCheckIconOk}`} />
                      : <AlertCircle size={ICON.sm} className={`${styles.testCheckIcon} ${styles.testCheckIconError}`} />}
                    <span className={`${styles.testCheckMessage} text-[12px]`}>{c.message}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ⑥ 자동 발송 */}
          {Array.isArray(autoConfigs) && autoConfigs.length > 0 && (
            <Card>
              <SectionHeader icon={<Send size={ICON.sm} />} title="자동 발송" desc="트리거별로 자동 발송 여부를 설정하세요." />
              <div className="flex flex-col gap-1.5">
                {autoConfigs.map((cfg, i) => (
                  <AutoSendRow key={cfg.id ?? i} config={cfg} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiStatCard({ icon, label, value, status, tone }: {
  icon: React.ReactNode; label: string; value: string; status: "ok" | "warn" | "none"; tone: "provider" | "sender" | "kakao" | "sms";
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
            {status === "ok" ? "연동" : "미설정"}
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
        {badge && (
          <span className={`${styles.sectionBadge} text-[10px] font-semibold`}>
            {badge}
          </span>
        )}
      </div>
      {desc && <p className={`${styles.sectionDesc} text-[11px] mt-1 m-0`}>{desc}</p>}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className={`${styles.fieldLabel} text-[11px] font-semibold block mb-1`}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`${styles.input} w-full text-sm`} />
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

function AutoSendRow({ config }: { config: AutoSendConfig }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const enabled = config.enabled ?? false;

  const toggleMut = useMutation({
    mutationFn: () => updateAutoSendConfig(config.trigger, { enabled: !enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-auto-send-configs"] });
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
            title="설정 편집">
            <Pencil size={ICON.sm} />
          </button>
          <button onClick={() => toggleMut.mutate()} type="button" className={`${styles.toggleButton} cursor-pointer`}>
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
  const [templateId, setTemplateId] = useState<number | null>(templateIdFromConfig(config));
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMinutesBefore(config.minutes_before != null ? String(config.minutes_before) : "");
    setTemplateId(templateIdFromConfig(config));
  }, [open, config]);

  const { data: templates } = useQuery({
    queryKey: ["teacher-msg-templates"],
    queryFn: fetchAllTemplates,
    enabled: open,
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        message_mode: "alimtalk",
        minutes_before: minutesBefore.trim() ? Number(minutesBefore) : null,
        template_id: templateId,
      };
      return updateAutoSendConfig(config.trigger, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-auto-send-configs"] });
      teacherToast.success("자동 발송 설정이 저장되었습니다.");
      onClose();
    },
    onError: () => teacherToast.error("저장에 실패했습니다."),
  });

  const triggerKey: string = config.trigger ?? "";
  const triggerLabel = AUTO_SEND_TRIGGER_LABELS[triggerKey] || triggerKey;
  const selectedTemplate = (templates ?? []).find((t) => t.id === templateId);
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
                className={`${styles.channelButton} ${styles.channelButtonActive} flex-1 text-[12px] font-semibold`}
              >
                알림톡
              </button>
            </div>
          </div>

          {/* 분/시간 전 */}
          {showMinutesBefore && (
            <div>
              <label className={`${styles.fieldLabel} text-[11px] font-semibold block mb-1`}>
                {triggerKey.includes("hours_before") ? "시간 전" : triggerKey.includes("days_before") ? "일 전" : "분 전"}
              </label>
              <input type="number" value={minutesBefore} onChange={(e) => setMinutesBefore(e.target.value)}
                placeholder="예: 10"
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
              {selectedTemplate && (
                <button onClick={() => setPreviewOpen(true)} type="button"
                  className={`${styles.templatePreviewButton} flex items-center gap-0.5 text-[11px] font-semibold cursor-pointer`}>
                  <Eye size={ICON.xs} /> 미리보기
                </button>
              )}
            </div>
            {templates && templates.length > 0 ? (
              <div className={`${styles.templateList} flex flex-col gap-1`}>
                {templates.map((t) => (
                  <button key={t.id} onClick={() => setTemplateId(t.id)} type="button"
                    className={`${styles.templateOption} ${templateId === t.id ? styles.templateOptionActive : ""} text-left cursor-pointer`}>
                    <div className={`${styles.templateName} text-[13px] font-semibold`}>{t.name}</div>
                    {t.category && (
                      <div className={`${styles.mutedText} text-[11px]`}>{t.category}</div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className={`${styles.emptyTemplates} text-[12px] text-center py-3`}>
                등록된 템플릿이 없습니다.
              </div>
            )}
          </div>

          <button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className={`${styles.fullSaveButton} w-full text-sm font-bold cursor-pointer mt-1`}>
            {saveMut.isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </BottomSheet>

      {/* Preview */}
      {selectedTemplate && (
        <BottomSheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="템플릿 미리보기">
          <div className={`${styles.sheetContent} flex flex-col gap-2`}>
            <div>
              <div className={`${styles.previewLabel} text-[11px]`}>이름</div>
              <div className={`${styles.previewValue} text-sm font-semibold`}>{selectedTemplate.name}</div>
            </div>
            {selectedTemplate.subject && (
              <div>
                <div className={`${styles.previewLabel} text-[11px]`}>제목</div>
                <div className={`${styles.previewValue} text-sm`}>{selectedTemplate.subject}</div>
              </div>
            )}
            <div>
              <div className={`${styles.previewLabel} text-[11px]`}>본문</div>
              <div className={`${styles.previewBody} text-[13px] mt-1`}>
                {selectedTemplate.body}
              </div>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
