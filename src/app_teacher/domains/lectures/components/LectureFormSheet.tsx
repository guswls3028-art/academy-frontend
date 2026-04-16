// PATH: src/app_teacher/domains/lectures/components/LectureFormSheet.tsx
// 강의 생성/편집 바텀시트
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLecture, updateLecture } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: any; // null = create mode
}

export default function LectureFormSheet({ open, onClose, editData }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editData;

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lectureTime, setLectureTime] = useState("");

  useEffect(() => {
    if (editData) {
      setTitle(editData.title || "");
      setName(editData.name || editData.instructor || "");
      setSubject(editData.subject || "");
      setColor(editData.color || COLORS[0]);
      setStartDate(editData.start_date || "");
      setEndDate(editData.end_date || "");
      setLectureTime(editData.lecture_time || editData.lectureTime || "");
    } else {
      setTitle(""); setName(""); setSubject(""); setColor(COLORS[0]);
      setStartDate(""); setEndDate(""); setLectureTime("");
    }
  }, [editData, open]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title, name, subject, color,
        start_date: startDate || null,
        end_date: endDate || null,
        lecture_time: lectureTime || null,
        is_active: true,
      };
      return isEdit ? updateLecture(editData.id, payload) : createLecture(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lectures-mobile"] });
      onClose();
    },
  });

  const canSubmit = title.trim().length > 0 && !mutation.isPending;

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? "강의 편집" : "강의 생성"}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Field label="강의명 *" value={title} onChange={setTitle} placeholder="예: 수학 심화반" />
        <Field label="강사" value={name} onChange={setName} placeholder="담당 강사명" />
        <Field label="과목" value={subject} onChange={setSubject} placeholder="예: 수학, 영어" />
        <Field label="수업 시간" value={lectureTime} onChange={setLectureTime} placeholder="예: 월수금 18:00~20:00" />

        <div className="flex gap-2">
          <Field label="시작일" value={startDate} onChange={setStartDate} type="date" />
          <Field label="종료일" value={endDate} onChange={setEndDate} type="date" />
        </div>

        {/* Color picker */}
        <div>
          <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--tc-text-muted)" }}>색상</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "3px solid var(--tc-text)" : "2px solid transparent",
                  cursor: "pointer",
                }} />
            ))}
          </div>
        </div>

        <button onClick={() => mutation.mutate()} disabled={!canSubmit}
          className="w-full text-sm font-bold cursor-pointer mt-2"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: canSubmit ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: canSubmit ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "저장 중..." : isEdit ? "수정" : "생성"}
        </button>

        {mutation.isError && (
          <div className="text-[12px] text-center" style={{ color: "var(--tc-danger)" }}>저장 실패. 다시 시도해주세요.</div>
        )}
      </div>
    </BottomSheet>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex-1">
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}
