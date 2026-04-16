// PATH: src/app_teacher/domains/exams/components/ExamManageSheet.tsx
// 시험 관리 시트 — 편집/삭제/상태토글/정답/합격점/재계산
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateExam, deleteExam } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import api from "@/shared/api/axios";

interface Props {
  open: boolean;
  onClose: () => void;
  exam: any;
  onDeleted: () => void;
}

export default function ExamManageSheet({ open, onClose, exam, onDeleted }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(exam?.title || "");
  const [passScore, setPassScore] = useState(String(exam?.pass_score ?? ""));
  const [msg, setMsg] = useState<string | null>(null);

  const editMut = useMutation({
    mutationFn: () => updateExam(exam.id, { title, pass_score: passScore ? Number(passScore) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-exams"] }); setMsg("저장됨"); },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteExam(exam.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-exams"] }); onDeleted(); onClose(); },
  });

  const toggleMut = useMutation({
    mutationFn: () => updateExam(exam.id, { is_active: !exam.is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-exams"] }); setMsg(exam.is_active ? "시험 닫힘" : "시험 열림"); },
  });

  const recalcMut = useMutation({
    mutationFn: () => api.post(`/exams/${exam.id}/recalculate/`),
    onSuccess: () => setMsg("재계산 완료"),
  });

  const saveTemplateMut = useMutation({
    mutationFn: () => api.post(`/exams/${exam.id}/save-as-template/`),
    onSuccess: () => setMsg("템플릿으로 저장됨"),
  });

  if (!exam) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title="시험 관리">
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        {/* Edit title + pass score */}
        <Fld label="시험명" value={title} onChange={setTitle} />
        <Fld label="합격점" value={passScore} onChange={setPassScore} type="number" placeholder="미설정" />

        <button onClick={() => editMut.mutate()} disabled={!title.trim() || editMut.isPending}
          className="w-full text-sm font-bold cursor-pointer"
          style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          {editMut.isPending ? "저장 중..." : "저장"}
        </button>

        <div style={{ height: 1, background: "var(--tc-border)", margin: "4px 0" }} />

        {/* Actions */}
        <div className="flex flex-col gap-1.5">
          <ActionBtn label={exam.is_active ? "시험 닫기" : "시험 열기"} color="var(--tc-info)" onClick={() => toggleMut.mutate()} />
          <ActionBtn label="템플릿으로 저장" color="var(--tc-text-secondary)" onClick={() => saveTemplateMut.mutate()} />
          <ActionBtn label="성적 재계산" color="var(--tc-warn)" onClick={() => recalcMut.mutate()} />
          <ActionBtn label="삭제" color="var(--tc-danger)" onClick={() => { if (confirm("시험을 삭제하시겠습니까?")) deleteMut.mutate(); }} />
        </div>

        {msg && <div className="text-[12px] text-center" style={{ color: "var(--tc-success)" }}>{msg}</div>}
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

function Fld({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
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
