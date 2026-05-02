/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/exams/components/ExamManageSheet.tsx
// 시험 관리 시트 — 편집/삭제/상태토글/정답/합격점/재계산/OMR/PDF
// R-11: 기존 인라인 style baseline. 마이그레이션은 별도 백로그.
import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateExam, deleteExam } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { Upload } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
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
  const [answerKey, setAnswerKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const editMut = useMutation({
    mutationFn: () => updateExam(exam.id, { title, pass_score: passScore ? Number(passScore) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-exams"] }); setMsg("저장됨"); },
    onError: (e) => teacherToast.error(extractApiError(e, "시험을 수정하지 못했습니다.")),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteExam(exam.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-exams"] }); onDeleted(); onClose(); },
    onError: (e) => teacherToast.error(extractApiError(e, "시험을 삭제하지 못했습니다.")),
  });

  const toggleMut = useMutation({
    mutationFn: () => updateExam(exam.id, { is_active: !exam.is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-exams"] }); setMsg(exam.is_active ? "시험 닫힘" : "시험 열림"); },
    onError: (e) => teacherToast.error(extractApiError(e, "상태를 변경하지 못했습니다.")),
  });

  const recalcMut = useMutation({
    mutationFn: () => api.post(`/exams/${exam.id}/recalculate/`),
    onSuccess: () => setMsg("재계산 완료"),
    onError: (e) => teacherToast.error(extractApiError(e, "재계산을 실행하지 못했습니다.")),
  });

  const saveTemplateMut = useMutation({
    mutationFn: () => api.post(`/exams/${exam.id}/save-as-template/`),
    onSuccess: () => setMsg("템플릿으로 저장됨"),
    onError: (e) => teacherToast.error(extractApiError(e, "템플릿으로 저장하지 못했습니다.")),
  });

  // 정답 등록: "1:2,2:3,3:1" 형식 → { "1":"2", "2":"3", "3":"1" }
  const answerKeyMut = useMutation({
    mutationFn: () => {
      const answers: Record<string, string> = {};
      answerKey.split(",").forEach((pair) => {
        const [q, a] = pair.split(":").map((s) => s.trim());
        if (q && a) answers[q] = a;
      });
      return api.post(`/exams/answer-keys/`, { exam: exam.id, answers });
    },
    onSuccess: () => { setMsg("정답 등록됨"); setAnswerKey(""); },
    onError: (e) => teacherToast.error(extractApiError(e, "정답을 등록하지 못했습니다.")),
  });

  const uploadAssetMut = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("asset_type", file.name.toLowerCase().includes("omr") ? "omr_sheet" : "exam_pdf");
      return api.post(`/exams/${exam.id}/assets/`, formData, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => setMsg("파일 업로드 완료"),
    onError: (e) => teacherToast.error(extractApiError(e, "파일 업로드에 실패했습니다.")),
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

        {/* Answer key registration */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>
            정답 등록 (형식: 1:2,2:3,3:1)
          </label>
          <div className="flex gap-2">
            <input type="text" value={answerKey} onChange={(e) => setAnswerKey(e.target.value)}
              placeholder="문번:정답,문번:정답,..."
              className="flex-1 text-sm"
              style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
            <button onClick={() => answerKeyMut.mutate()} disabled={!answerKey.trim()}
              className="text-xs font-bold cursor-pointer shrink-0"
              style={{ padding: "8px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff", opacity: !answerKey.trim() ? 0.5 : 1 }}>
              등록
            </button>
          </div>
        </div>

        {/* File upload (PDF/OMR) */}
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-[12px] font-semibold cursor-pointer flex-1 justify-center"
            style={{ padding: "8px", borderRadius: "var(--tc-radius-sm)", border: "1px dashed var(--tc-border-strong)", background: "none", color: "var(--tc-text-secondary)" }}>
            <Upload size={13} /> PDF / OMR 업로드
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.xlsx,.csv,image/*" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAssetMut.mutate(f); if (fileRef.current) fileRef.current.value = ""; }} />
        </div>

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
