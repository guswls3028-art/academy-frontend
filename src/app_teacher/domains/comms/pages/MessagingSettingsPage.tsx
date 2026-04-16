// PATH: src/app_teacher/domains/comms/pages/MessagingSettingsPage.tsx
// 메시징 설정 — 공급자/발신번호/PFID + 자동발송 설정
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Save } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchMessagingInfo, updateMessagingInfo, fetchAutoSendConfigs, updateAutoSendConfigs } from "../api";
import api from "@/shared/api/axios";

export default function MessagingSettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: info, isLoading } = useQuery({
    queryKey: ["teacher-messaging-info"],
    queryFn: fetchMessagingInfo,
  });

  const { data: autoConfigs } = useQuery({
    queryKey: ["teacher-auto-send-configs"],
    queryFn: fetchAutoSendConfigs,
  });

  const [sender, setSender] = useState("");
  const [pfid, setPfid] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  // Init from info
  useState(() => {
    if (info) {
      setSender(info.messaging_sender || "");
      setPfid(info.kakao_pfid || "");
    }
  });

  const saveMut = useMutation({
    mutationFn: () => updateMessagingInfo({ messaging_sender: sender, kakao_pfid: pfid }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-messaging-info"] }); setMsg("저장됨"); setTimeout(() => setMsg(null), 2000); },
  });

  const verifyMut = useMutation({
    mutationFn: () => api.post("/messaging/verify-sender/", { phone_number: sender }),
    onSuccess: (res: any) => setMsg(res.data?.verified ? "발신번호 인증 완료" : "인증 실패"),
    onError: () => setMsg("인증 실패"),
  });

  const testMut = useMutation({
    mutationFn: () => api.post("/messaging/test-credentials/"),
    onSuccess: (res: any) => setMsg(res.data?.all_ok ? "연동 테스트 성공" : `테스트 실패: ${res.data?.summary}`),
    onError: () => setMsg("테스트 실패"),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>메시징 설정</h1>
      </div>

      {isLoading ? <EmptyState scope="panel" tone="loading" title="불러오는 중..." /> : (
        <>
          {/* Status card */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>연동 상태</span>
              <Badge tone={info?.sms_allowed ? "success" : "danger"} size="xs">{info?.sms_allowed ? "활성" : "비활성"}</Badge>
            </div>
            <div className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
              <span>공급자: {info?.messaging_provider || "미설정"}</span>
              <span>발신번호: {info?.messaging_sender || "미등록"}</span>
              {info?.balance != null && <span>잔액: {info.balance.toLocaleString()}원</span>}
            </div>
          </Card>

          {/* Settings form */}
          <Card>
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>발신번호</label>
                <div className="flex gap-2">
                  <input type="tel" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="010-0000-0000"
                    className="flex-1 text-sm"
                    style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
                  <button onClick={() => verifyMut.mutate()} disabled={!sender}
                    className="text-xs font-bold cursor-pointer shrink-0"
                    style={{ padding: "8px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-info-bg)", color: "var(--tc-info)" }}>
                    인증
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>카카오 PFID</label>
                <input type="text" value={pfid} onChange={(e) => setPfid(e.target.value)} placeholder="@카카오채널ID"
                  className="w-full text-sm"
                  style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1 text-sm font-bold cursor-pointer"
                  style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
                  <Save size={14} /> 저장
                </button>
                <button onClick={() => testMut.mutate()} disabled={testMut.isPending}
                  className="flex-1 text-sm font-semibold cursor-pointer"
                  style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
                  연동 테스트
                </button>
              </div>
            </div>
          </Card>

          {/* Auto-send configs */}
          {Array.isArray(autoConfigs) && autoConfigs.length > 0 && (
            <Card>
              <div className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>자동 발송 설정</div>
              <div className="flex flex-col gap-2">
                {autoConfigs.map((cfg: any, i: number) => (
                  <AutoSendRow key={cfg.id ?? i} config={cfg} />
                ))}
              </div>
            </Card>
          )}

          {msg && <div className="text-[12px] text-center font-medium" style={{ color: "var(--tc-success)" }}>{msg}</div>}
        </>
      )}
    </div>
  );
}

function AutoSendRow({ config }: { config: any }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(config.enabled ?? false);

  const toggleMut = useMutation({
    mutationFn: () => updateAutoSendConfigs([{ ...config, enabled: !enabled }]),
    onSuccess: () => { setEnabled(!enabled); qc.invalidateQueries({ queryKey: ["teacher-auto-send-configs"] }); },
  });

  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <div className="text-[13px] font-medium" style={{ color: "var(--tc-text)" }}>{config.trigger_label || config.trigger || "트리거"}</div>
        {config.template_name && <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>템플릿: {config.template_name}</div>}
      </div>
      <button onClick={() => toggleMut.mutate()} type="button" className="cursor-pointer"
        style={{ background: "none", border: "none", padding: 0 }}>
        <div className="w-10 h-5 rounded-full relative"
          style={{ background: enabled ? "var(--tc-primary)" : "var(--tc-border-strong)", transition: "background 150ms" }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
            style={{ left: enabled ? 20 : 2, transition: "left 150ms" }} />
        </div>
      </button>
    </div>
  );
}
