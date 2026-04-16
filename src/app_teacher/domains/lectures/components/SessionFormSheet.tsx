// PATH: src/app_teacher/domains/lectures/components/SessionFormSheet.tsx
// 차시 생성/편집 바텀시트
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSession, updateSession } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  lectureId: number;
  editData?: any; // null = create
}

export default function SessionFormSheet({ open, onClose, lectureId, editData }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editData;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [order, setOrder] = useState("");

  useEffect(() => {
    if (editData) {
      setTitle(editData.title || "");
      setDate(editData.date || "");
      setOrder(editData.order != null ? String(editData.order) : "");
    } else {
      setTitle(""); setDate(""); setOrder("");
    }
  }, [editData, open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return updateSession(editData.id, { title, date: date || undefined, order: order ? Number(order) : undefined });
      }
      return createSession(lectureId, title, date || null, order ? Number(order) : null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecture-sessions"] });
      qc.invalidateQueries({ queryKey: ["lecture-detail"] });
      onClose();
    },
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? "차시 편집" : "차시 추가"}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>차시명 *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 1차시, 중간고사 대비"
            className="w-full text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>날짜</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm"
              style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          </div>
          <div style={{ width: 80 }}>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>순서</label>
            <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="#"
              className="w-full text-sm"
              style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          </div>
        </div>

        <button onClick={() => mutation.mutate()} disabled={!title.trim() || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-2"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: title.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: title.trim() ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "저장 중..." : isEdit ? "수정" : "추가"}
        </button>
      </div>
    </BottomSheet>
  );
}
