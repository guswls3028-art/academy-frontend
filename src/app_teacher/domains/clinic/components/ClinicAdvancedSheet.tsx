// PATH: src/app_teacher/domains/clinic/components/ClinicAdvancedSheet.tsx
// 클리닉 고급 액션 시트 — 보강 점수 입력, 면제, 이월, 수동 통과
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import api from "@/shared/api/axios";

interface Props {
  open: boolean;
  onClose: () => void;
  participant: any; // clinic participant or link object
  sessionId: number;
}

export default function ClinicAdvancedSheet({ open, onClose, participant, sessionId }: Props) {
  const qc = useQueryClient();
  const [retakeScore, setRetakeScore] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["teacher-clinic-participants", sessionId] });

  const resolveMut = useMutation({
    mutationFn: () => api.post(`/clinic/links/${participant?.link_id ?? participant?.id}/resolve/`, { memo: "모바일 수동 통과" }),
    onSuccess: () => { invalidate(); setMsg("수동 통과 처리됨"); },
  });

  const waiveMut = useMutation({
    mutationFn: () => api.post(`/clinic/links/${participant?.link_id ?? participant?.id}/waive/`, { memo: "면제" }),
    onSuccess: () => { invalidate(); setMsg("면제 처리됨"); },
  });

  const carryOverMut = useMutation({
    mutationFn: () => api.post(`/clinic/links/${participant?.link_id ?? participant?.id}/carry-over/`),
    onSuccess: () => { invalidate(); setMsg("다음 차수 이월됨"); },
  });

  const retakeMut = useMutation({
    mutationFn: () => api.post(`/clinic/links/${participant?.link_id ?? participant?.id}/retake/`, {
      score: Number(retakeScore),
    }),
    onSuccess: () => { invalidate(); setRetakeScore(""); setMsg("보강 점수 등록됨"); },
  });

  const uncompleteMut = useMutation({
    mutationFn: () => api.post(`/clinic/participants/${participant?.id}/uncomplete/`),
    onSuccess: () => { invalidate(); setMsg("완료 취소됨"); },
  });

  if (!participant) return null;
  const name = participant.student_name ?? participant.enrollment_name ?? "학생";

  return (
    <BottomSheet open={open} onClose={onClose} title={`${name} — 고급 관리`}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        {/* Retake score */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>보강 점수 입력</label>
          <div className="flex gap-2">
            <input type="number" value={retakeScore} onChange={(e) => setRetakeScore(e.target.value)} placeholder="점수"
              className="flex-1 text-sm"
              style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
            <button onClick={() => retakeMut.mutate()} disabled={!retakeScore || retakeMut.isPending}
              className="text-xs font-bold cursor-pointer shrink-0"
              style={{ padding: "8px 14px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: !retakeScore ? 0.5 : 1 }}>
              등록
            </button>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--tc-border)" }} />

        {/* Quick actions */}
        <ActionBtn label="수동 통과" color="var(--tc-success)" onClick={() => resolveMut.mutate()} />
        <ActionBtn label="면제" color="var(--tc-info)" onClick={() => { if (confirm("면제 처리하시겠습니까?")) waiveMut.mutate(); }} />
        <ActionBtn label="다음 차수 이월" color="var(--tc-warn)" onClick={() => { if (confirm("다음 차수로 이월하시겠습니까?")) carryOverMut.mutate(); }} />
        {participant.is_completed && (
          <ActionBtn label="완료 취소" color="var(--tc-danger)" onClick={() => { if (confirm("완료를 취소하시겠습니까?")) uncompleteMut.mutate(); }} />
        )}

        {msg && <div className="text-[12px] text-center font-medium" style={{ color: "var(--tc-success)" }}>{msg}</div>}
      </div>
    </BottomSheet>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left text-sm font-medium cursor-pointer"
      style={{ padding: "10px 12px", borderRadius: "var(--tc-radius-sm)", border: "none", background: `color-mix(in srgb, ${color} 8%, transparent)`, color }}>
      {label}
    </button>
  );
}
