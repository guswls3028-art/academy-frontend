// PATH: src/app_teacher/domains/comms/pages/MessagingSettingsPage.tsx
// 메시지 설정 — 공급자 선택 + 자체 API 키 + 발신번호 + 알림톡 + 연동 테스트 + 자동발송
// 데스크탑 MessageSettingsPage와 정보 구조·설정 흐름을 일치시킨 모바일 버전
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Check, AlertCircle, Phone, Send, MessageCircle, Settings, CheckCircle, Lock, Pencil, Eye } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import {
  fetchMessagingInfo, updateMessagingInfo, verifySender, testCredentials,
  fetchAutoSendConfigs, updateAutoSendConfigs, updateAutoSendConfig, fetchAllTemplates,
  AUTO_SEND_TRIGGER_LABELS, MESSAGE_MODE_LABELS,
  type MessagingProvider, type TestCredentialsResult,
} from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { useConfirm } from "@/shared/ui/confirm";

const SERVER_IP = "43.201.119.172";

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
    onError: (err: any) => setVerifyMsg({ ok: false, msg: err?.response?.data?.detail || "인증 확인에 실패했습니다." }),
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
  const hasOwnCreds = info?.has_own_credentials ?? false;
  const canSend = !!info?.sms_allowed || hasOwnCreds;
  const providerLabel = provider === "ppurio" ? "뿌리오" : "솔라피";

  const setupSteps = [
    { done: canSend, label: "API 연동" },
    { done: hasSender, label: "발신번호" },
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
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>메시지 설정</h1>
      </div>

      {isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}

      {!isLoading && info && (
        <>
          {/* 설정 완료 안내 */}
          {!allSetupDone && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: "var(--tc-radius)",
              background: "var(--tc-warn-bg)",
              border: "1px solid var(--tc-warn)",
            }}>
              <AlertCircle size={15} style={{ color: "var(--tc-warn)", flexShrink: 0 }} />
              <div className="text-[12px]" style={{ color: "var(--tc-text-secondary)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--tc-text)" }}>메시지 발송 설정을 완료해 주세요.</strong>
                <span style={{ marginLeft: 6 }}>
                  {setupSteps.filter((s) => !s.done).map((s) => s.label).join(", ")} 설정이 필요합니다.
                </span>
              </div>
            </div>
          )}

          {/* KPI 요약 — 2x2 */}
          <div className="grid grid-cols-2 gap-2">
            <KpiStatCard icon={<Settings size={14} />} label="공급자" value={providerLabel} status={canSend ? "ok" : "warn"} color="#6366f1" />
            <KpiStatCard icon={<Phone size={14} />} label="발신번호" value={info.messaging_sender || "미등록"} status={hasSender ? "ok" : "warn"} color="#0ea5e9" />
            <KpiStatCard icon={<Send size={14} />} label="알림톡" value={hasPfid ? "사용 가능" : "미설정"} status={hasPfid ? "ok" : "none"} color="#f59e0b" />
            <KpiStatCard icon={<MessageCircle size={14} />} label="SMS" value={info.sms_allowed ? "사용 가능" : "미설정"} status={info.sms_allowed ? "ok" : "warn"} color="#10b981" />
          </div>

          {/* 잔액 (보조 정보) */}
          {info.balance != null && (
            <div className="text-[12px] text-center" style={{ color: "var(--tc-text-muted)" }}>
              잔액: <span style={{ color: "var(--tc-text)", fontWeight: 600 }}>{info.balance.toLocaleString()}원</span>
              {info.sms_price != null ? ` · SMS ${info.sms_price}원` : ""}
              {info.alimtalk_price != null ? ` · 알림톡 ${info.alimtalk_price}원` : ""}
            </div>
          )}

          {/* ① 공급자 선택 */}
          <Card>
            <SectionHeader icon={<Settings size={13} />} title="메시지 공급자" desc="SMS·알림톡 발송에 사용할 공급자를 선택하세요." />
            <div className="flex gap-0 rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--tc-border-strong)" }}>
              {([
                { k: "solapi" as const, l: "솔라피(Solapi)" },
                { k: "ppurio" as const, l: "뿌리오(Ppurio)" },
              ]).map((opt) => (
                <button key={opt.k} onClick={() => handleChangeProvider(opt.k)}
                  className="flex-1 text-[13px] font-bold cursor-pointer"
                  style={{
                    padding: "8px 12px",
                    border: "none",
                    background: provider === opt.k ? "var(--tc-primary)" : "var(--tc-surface-soft)",
                    color: provider === opt.k ? "#fff" : "var(--tc-text-secondary)",
                    transition: "background 0.15s",
                  }}>
                  {opt.l}
                </button>
              ))}
            </div>
          </Card>

          {/* ② API 키 등록 */}
          <Card>
            <SectionHeader icon={<Lock size={13} />} title="API 연동 설정" desc={provider === "solapi"
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
                <p className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                  뿌리오 [연동] → [연동관리] 에서 연동 IP <code style={{ padding: "1px 4px", borderRadius: 3, background: "var(--tc-surface-soft)", fontSize: 11 }}>{SERVER_IP}</code> 를 반드시 등록하세요.
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={handleSaveOwnCreds} disabled={updateMut.isPending}
                className="text-xs font-bold cursor-pointer"
                style={{ padding: "8px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
                {updateMut.isPending ? "저장 중…" : "저장"}
              </button>
              {hasOwnCreds && (
                <button onClick={handleClearOwnCreds} disabled={updateMut.isPending}
                  className="text-xs font-semibold cursor-pointer"
                  style={{ padding: "8px 12px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
                  초기화
                </button>
              )}
              {hasOwnCreds && <StatusChip ok label="연동됨" />}
            </div>
          </Card>

          {/* ③ 발신번호 */}
          <Card>
            <SectionHeader icon={<Phone size={13} />} title="발신번호" desc={`${providerLabel}에 등록된 발신번호를 입력하세요.`} />
            <div className="flex flex-col gap-2">
              <input type="tel" value={sender} onChange={(e) => { setSender(e.target.value); setVerifyMsg(null); }}
                placeholder="예: 01012345678"
                className="w-full text-sm"
                style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
              <div className="flex gap-2 flex-wrap">
                {provider === "solapi" && (
                  <button onClick={handleVerifySender} disabled={!sender.trim() || verifyMut.isPending}
                    className="text-xs font-semibold cursor-pointer"
                    style={{ padding: "8px 12px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
                    {verifyMut.isPending ? "확인 중…" : "인증 확인"}
                  </button>
                )}
                <button onClick={handleSaveSender} disabled={!sender.trim() || updateMut.isPending}
                  className="text-xs font-bold cursor-pointer"
                  style={{ padding: "8px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
                  {updateMut.isPending ? "저장 중…" : "저장"}
                </button>
              </div>
              {verifyMsg && (
                <p className="text-[12px] font-semibold flex items-center gap-1 m-0"
                  style={{ color: verifyMsg.ok ? "var(--tc-success)" : "var(--tc-danger)" }}>
                  {verifyMsg.ok ? <Check size={12} /> : <AlertCircle size={12} />}
                  {verifyMsg.msg}
                </p>
              )}
            </div>
          </Card>

          {/* ④ 카카오 알림톡 */}
          <Card>
            <SectionHeader icon={<MessageCircle size={13} />} title="카카오 알림톡 채널" desc={hasPfid
              ? "알림톡 채널이 연동되어 있습니다."
              : "SMS만 사용한다면 이 항목은 건너뛰세요."} badge="선택" />
            <div className="flex gap-2 flex-wrap">
              <input type="text" value={pfid} onChange={(e) => setPfid(e.target.value)}
                placeholder="예: @yourChannel"
                className="flex-1 text-sm"
                style={{ minWidth: 0, padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
              <button onClick={handleSavePfid} disabled={!pfid.trim() || updateMut.isPending}
                className="text-xs font-bold cursor-pointer shrink-0"
                style={{ padding: "8px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
                {updateMut.isPending ? "저장 중…" : "저장"}
              </button>
            </div>
            {hasPfid && (
              <div className="flex items-center gap-2 mt-2">
                <StatusChip ok label="연동됨" />
                <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                  현재 PFID: <code style={{ padding: "1px 4px", borderRadius: 3, background: "var(--tc-surface-soft)", fontSize: 11 }}>{info.kakao_pfid}</code>
                </span>
              </div>
            )}
          </Card>

          {/* ⑤ 연동 테스트 */}
          <Card>
            <SectionHeader icon={<CheckCircle size={13} />} title="연동 테스트" desc="설정이 끝났다면 아래 버튼으로 연동 상태를 확인하세요." />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { setTestResult(null); testMut.mutate(); }} disabled={testMut.isPending}
                className="text-xs font-bold cursor-pointer"
                style={{ padding: "8px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
                {testMut.isPending ? "테스트 중…" : "연동 상태 테스트"}
              </button>
              {testResult && <StatusChip ok={testResult.all_ok} label={testResult.all_ok ? "모두 정상" : "확인 필요"} />}
            </div>
            {testResult && (
              <div className="flex flex-col gap-1.5 mt-2.5">
                {testResult.checks.map((c, i) => (
                  <div key={i} className="flex items-start gap-2"
                    style={{
                      padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
                      background: c.ok ? "var(--tc-success-bg)" : "var(--tc-danger-bg)",
                      border: `1px solid ${c.ok ? "var(--tc-success)" : "var(--tc-danger)"}`,
                    }}>
                    {c.ok
                      ? <CheckCircle size={13} style={{ color: "var(--tc-success)", marginTop: 2, flexShrink: 0 }} />
                      : <AlertCircle size={13} style={{ color: "var(--tc-danger)", marginTop: 2, flexShrink: 0 }} />}
                    <span className="text-[12px]" style={{ color: "var(--tc-text)", lineHeight: 1.5 }}>{c.message}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ⑥ 자동 발송 */}
          {Array.isArray(autoConfigs) && autoConfigs.length > 0 && (
            <Card>
              <SectionHeader icon={<Send size={13} />} title="자동 발송" desc="트리거별로 자동 발송 여부를 설정하세요." />
              <div className="flex flex-col gap-1.5">
                {autoConfigs.map((cfg: any, i: number) => (
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

function KpiStatCard({ icon, label, value, status, color }: {
  icon: React.ReactNode; label: string; value: string; status: "ok" | "warn" | "none"; color: string;
}) {
  const statusColor = status === "ok" ? "var(--tc-success)" : status === "warn" ? "var(--tc-warn)" : "var(--tc-text-muted)";
  return (
    <div style={{
      padding: "12px 14px", borderRadius: "var(--tc-radius)",
      background: "var(--tc-surface)", border: "1px solid var(--tc-border)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div className="flex items-center gap-1.5">
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          display: "grid", placeItems: "center",
          background: `color-mix(in srgb, ${color} 10%, transparent)`, color,
        }}>{icon}</div>
        <span className="text-[11px] font-semibold" style={{ color: "var(--tc-text-muted)" }}>{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[13px] font-bold truncate" style={{ color: "var(--tc-text)" }}>{value}</span>
        {status !== "none" && (
          <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: statusColor }}>
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
        <span style={{ color: "var(--tc-primary)", display: "flex" }}>{icon}</span>
        <span className="text-[14px] font-bold" style={{ color: "var(--tc-text)" }}>{title}</span>
        {badge && (
          <span className="text-[10px] font-semibold"
            style={{ padding: "2px 6px", borderRadius: "var(--tc-radius-full)", background: "var(--tc-surface-soft)", color: "var(--tc-text-muted)" }}>
            {badge}
          </span>
        )}
      </div>
      {desc && <p className="text-[11px] mt-1 m-0" style={{ color: "var(--tc-text-muted)", lineHeight: 1.5 }}>{desc}</p>}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="text-[11px] font-semibold flex items-center gap-0.5"
      style={{
        padding: "2px 8px", borderRadius: "var(--tc-radius-full)",
        background: ok ? "var(--tc-success-bg)" : "var(--tc-warn-bg)",
        color: ok ? "var(--tc-success)" : "var(--tc-warn)",
      }}>
      {ok ? <Check size={10} /> : <AlertCircle size={10} />}
      {label}
    </span>
  );
}

function AutoSendRow({ config }: { config: any }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const enabled = config.enabled ?? false;

  const toggleMut = useMutation({
    mutationFn: () => config.id
      ? updateAutoSendConfig(config.id, { enabled: !enabled })
      : updateAutoSendConfigs([{ ...config, enabled: !enabled }]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-auto-send-configs"] });
      teacherToast.success(!enabled ? "자동 발송을 켰습니다." : "자동 발송을 껐습니다.");
    },
  });

  const triggerKey: string = config.trigger ?? "";
  const triggerLabel = AUTO_SEND_TRIGGER_LABELS[triggerKey] || config.trigger_label || config.trigger_name || triggerKey || "트리거";
  const templateName = config.template_name || config.template?.name;
  const modeLabel = config.message_mode ? MESSAGE_MODE_LABELS[config.message_mode] || config.message_mode : null;
  const minutesBefore = config.minutes_before;

  return (
    <>
      <div className="flex items-start gap-2"
        style={{ padding: "10px 12px", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-surface-soft)" }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>{triggerLabel}</span>
            {modeLabel && <Badge tone="neutral" size="xs">{modeLabel}</Badge>}
            {minutesBefore != null && minutesBefore > 0 && (
              <Badge tone="neutral" size="xs">{minutesBefore}분 전</Badge>
            )}
          </div>
          {templateName && (
            <div className="text-[11px] truncate mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
              템플릿: {templateName}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setEditOpen(true)} type="button"
            className="flex p-1 cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}
            title="설정 편집">
            <Pencil size={13} />
          </button>
          <button onClick={() => toggleMut.mutate()} type="button" className="cursor-pointer"
            style={{ background: "none", border: "none", padding: 0 }}>
            <div className="w-10 h-5 rounded-full relative"
              style={{ background: enabled ? "var(--tc-primary)" : "var(--tc-border-strong)", transition: "background 150ms" }}>
              <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                style={{ left: enabled ? 20 : 2, transition: "left 150ms" }} />
            </div>
          </button>
        </div>
      </div>
      <AutoSendEditSheet open={editOpen} onClose={() => setEditOpen(false)} config={config} />
    </>
  );
}

/* ─── Auto Send Edit Sheet ─── */
function AutoSendEditSheet({ open, onClose, config }: { open: boolean; onClose: () => void; config: any }) {
  const qc = useQueryClient();
  const [messageMode, setMessageMode] = useState<string>(config.message_mode ?? "alimtalk");
  const [minutesBefore, setMinutesBefore] = useState<string>(
    config.minutes_before != null ? String(config.minutes_before) : ""
  );
  const [templateId, setTemplateId] = useState<number | null>(config.template ?? config.template_id ?? null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessageMode(config.message_mode ?? "alimtalk");
    setMinutesBefore(config.minutes_before != null ? String(config.minutes_before) : "");
    setTemplateId(config.template ?? config.template_id ?? null);
  }, [open, config]);

  const { data: templates } = useQuery({
    queryKey: ["teacher-msg-templates"],
    queryFn: fetchAllTemplates,
    enabled: open,
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        message_mode: messageMode,
        minutes_before: minutesBefore.trim() ? Number(minutesBefore) : null,
        template_id: templateId,
      };
      return config.id
        ? updateAutoSendConfig(config.id, payload)
        : updateAutoSendConfigs([{ ...config, ...payload }]);
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
  const selectedTemplate = (templates ?? []).find((t: any) => t.id === templateId);
  const showMinutesBefore = triggerKey.includes("minutes_before") || triggerKey.includes("reminder") || triggerKey.includes("days_before") || triggerKey.includes("hours_before");

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={triggerLabel}>
        <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
          {/* 메시지 모드 */}
          <div>
            <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--tc-text-muted)" }}>발송 채널</label>
            <div className="flex gap-1.5">
              {([
                { k: "alimtalk", l: "알림톡" },
                { k: "sms", l: "SMS" },
                { k: "alimtalk_sms_fallback", l: "알림톡(대체 SMS)" },
              ]).map(({ k, l }) => (
                <button key={k} onClick={() => setMessageMode(k)} type="button"
                  className="flex-1 text-[12px] font-semibold cursor-pointer"
                  style={{
                    padding: "8px 8px",
                    borderRadius: "var(--tc-radius-sm)",
                    border: `1px solid ${messageMode === k ? "var(--tc-primary)" : "var(--tc-border-strong)"}`,
                    background: messageMode === k ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                    color: messageMode === k ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* 분/시간 전 */}
          {showMinutesBefore && (
            <div>
              <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>
                {triggerKey.includes("hours_before") ? "시간 전" : triggerKey.includes("days_before") ? "일 전" : "분 전"}
              </label>
              <input type="number" value={minutesBefore} onChange={(e) => setMinutesBefore(e.target.value)}
                placeholder="예: 10"
                className="w-full text-sm"
                style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
              <p className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
                이벤트 발생 {minutesBefore || "--"} 단위 전에 자동 발송합니다.
              </p>
            </div>
          )}

          {/* 템플릿 선택 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold" style={{ color: "var(--tc-text-muted)" }}>템플릿</label>
              {selectedTemplate && (
                <button onClick={() => setPreviewOpen(true)} type="button"
                  className="flex items-center gap-0.5 text-[11px] font-semibold cursor-pointer"
                  style={{ background: "none", border: "none", color: "var(--tc-primary)" }}>
                  <Eye size={11} /> 미리보기
                </button>
              )}
            </div>
            {templates && templates.length > 0 ? (
              <div className="flex flex-col gap-1" style={{ maxHeight: 280, overflowY: "auto" }}>
                {templates.map((t: any) => (
                  <button key={t.id} onClick={() => setTemplateId(t.id)} type="button"
                    className="text-left cursor-pointer"
                    style={{
                      padding: "8px 10px", borderRadius: "var(--tc-radius-sm)",
                      border: `1px solid ${templateId === t.id ? "var(--tc-primary)" : "var(--tc-border)"}`,
                      background: templateId === t.id ? "var(--tc-primary-bg)" : "var(--tc-surface)",
                    }}>
                    <div className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>{t.name}</div>
                    {t.category && (
                      <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>{t.category}</div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-center py-3"
                style={{ color: "var(--tc-text-muted)", background: "var(--tc-surface-soft)", borderRadius: "var(--tc-radius-sm)" }}>
                등록된 템플릿이 없습니다.
              </div>
            )}
          </div>

          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="w-full text-sm font-bold cursor-pointer mt-1"
            style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
            {saveMut.isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </BottomSheet>

      {/* Preview */}
      {selectedTemplate && (
        <BottomSheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="템플릿 미리보기">
          <div className="flex flex-col gap-2" style={{ padding: "var(--tc-space-3) 0" }}>
            <div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>이름</div>
              <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{selectedTemplate.name}</div>
            </div>
            {selectedTemplate.subject && (
              <div>
                <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>제목</div>
                <div className="text-sm" style={{ color: "var(--tc-text)" }}>{selectedTemplate.subject}</div>
              </div>
            )}
            <div>
              <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>본문</div>
              <div className="text-[13px] mt-1"
                style={{
                  padding: "10px 12px", borderRadius: "var(--tc-radius-sm)",
                  background: "var(--tc-surface-soft)", color: "var(--tc-text)",
                  whiteSpace: "pre-wrap", lineHeight: 1.6,
                }}>
                {selectedTemplate.body}
              </div>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
