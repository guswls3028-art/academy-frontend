/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/lectures/components/SessionFormSheet.tsx
// 차시 생성/편집 바텀시트
// R-11: 기존 인라인 style baseline. 마이그레이션은 별도 백로그.
import { useState, useEffect } from "react";
import { ICON } from "@/shared/ui/ds";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "@teacher/shared/ui/Icons";
import { createSession, updateSession, deleteSession } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
interface Props {
  open: boolean;
  onClose: () => void;
  lectureId: number;
  editData?: any; // null = create
}

export default function SessionFormSheet({ open, onClose, lectureId, editData }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const isEdit = !!editData;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [regularOrder, setRegularOrder] = useState("");

  useEffect(() => {
    if (editData) {
      setTitle(editData.title || "");
      setDate(editData.date || "");
      setRegularOrder(editData.regular_order != null ? String(editData.regular_order) : editData.order != null ? String(editData.order) : "");
    } else {
      setTitle(""); setDate(""); setRegularOrder("");
    }
  }, [editData, open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return updateSession(editData.id, { title, date: date || undefined, regular_order: regularOrder ? Number(regularOrder) : undefined });
      }
      return createSession(lectureId, title, date || undefined, regularOrder ? Number(regularOrder) : undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecture-sessions"] });
      qc.invalidateQueries({ queryKey: ["lecture-detail"] });
      teacherToast.success(isEdit ? `${title} 차시가 수정되었습니다.` : `${title} 차시가 추가되었습니다.`);
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, isEdit ? "차시를 수정하지 못했습니다." : "차시를 추가하지 못했습니다.")),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteSession(editData?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecture-sessions"] });
      qc.invalidateQueries({ queryKey: ["lecture-detail"] });
      teacherToast.info(`${editData?.title || "차시"}가 삭제되었습니다.`);
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "차시를 삭제하지 못했습니다.")),
  });

  const handleDelete = async () => {
    if (!editData?.id) return;
    const ok = await confirm({
      title: "차시 삭제",
      message: "이 차시를 삭제하시겠습니까? 관련된 시험·과제·출결 데이터가 모두 삭제됩니다.",
      confirmText: "삭제",
      danger: true,
    });
    if (ok) deleteMut.mutate();
  };

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
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>차시 번호</label>
            <input type="number" value={regularOrder} onChange={(e) => setRegularOrder(e.target.value)} placeholder="#"
              className="w-full text-sm"
              style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          </div>
        </div>

        <button onClick={() => mutation.mutate()} disabled={!title.trim() || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-2"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: title.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: title.trim() ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "저장 중..." : isEdit ? "수정" : "추가"}
        </button>

        {/* 편집 모드에서만 노출. 1차 행 인라인 휴지통 제거 → 시트 안 명시 액션으로 격리 (오탭 방지) */}
        {isEdit && (
          <button onClick={handleDelete} disabled={deleteMut.isPending}
            className="flex items-center justify-center gap-1.5 w-full text-[13px] font-semibold cursor-pointer"
            style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-danger)", background: "transparent", color: "var(--tc-danger)" }}>
            <Trash2 size={ICON.xs} />
            {deleteMut.isPending ? "삭제 중..." : "차시 삭제"}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
