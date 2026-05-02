/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/exams/components/ExamFormSheet.tsx
// 시험/과제 생성 바텀시트
// R-11: 기존 인라인 style baseline. 마이그레이션은 별도 백로그.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRegularExam, createHomework } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "exam" | "homework";
}

export default function ExamFormSheet({ open, onClose, mode }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === "homework") {
        return createHomework({ title, max_score: Number(maxScore) || 100, description: description || undefined });
      }
      return createRegularExam({ title, description: description || undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mode === "exam" ? ["teacher-exams"] : ["teacher-homeworks"] });
      teacherToast.success(`${title} ${label}이 생성되었습니다.`);
      setTitle(""); setMaxScore("100"); setDescription("");
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, `${label}을 생성하지 못했습니다.`)),
  });

  const label = mode === "exam" ? "시험" : "과제";

  return (
    <BottomSheet open={open} onClose={onClose} title={`${label} 생성`}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}명 *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${label} 이름`}
            className="w-full text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
        </div>
        {mode === "homework" && (
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>만점</label>
            <input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="100"
              className="w-full text-sm"
              style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          </div>
        )}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>설명 (선택)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="설명을 입력하세요"
            className="w-full text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none", resize: "vertical" }} />
        </div>
        <button onClick={() => mutation.mutate()} disabled={!title.trim() || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: title.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: title.trim() ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "생성 중..." : `${label} 생성`}
        </button>
      </div>
    </BottomSheet>
  );
}
