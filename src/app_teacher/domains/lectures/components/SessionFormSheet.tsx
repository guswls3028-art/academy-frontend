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
import { teacherLectureQueryKeys } from "../queryKeys";
import { isSupplementSession, type SessionType } from "@/shared/product/sessions/sessionOrdering";
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
  const [sessionType, setSessionType] = useState<SessionType>("REGULAR");

  useEffect(() => {
    if (editData) {
      const supplement = isSupplementSession(editData);
      setSessionType(supplement ? "SUPPLEMENT" : "REGULAR");
      setTitle(editData.title || "");
      setDate(editData.date || "");
      setRegularOrder(supplement ? "" : editData.regular_order != null ? String(editData.regular_order) : editData.order != null ? String(editData.order) : "");
    } else {
      setTitle(""); setDate(""); setRegularOrder(""); setSessionType("REGULAR");
    }
  }, [editData, open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return updateSession(editData.id, {
          title: title.trim(),
          date: date || undefined,
          ...(sessionType === "REGULAR" && regularOrder.trim() ? { regular_order: Number(regularOrder) } : {}),
        });
      }
      return createSession(
        lectureId,
        title.trim(),
        date || undefined,
        sessionType === "REGULAR" && regularOrder.trim() ? Number(regularOrder) : undefined,
        sessionType,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherLectureQueryKeys.lectureSessions });
      qc.invalidateQueries({ queryKey: teacherLectureQueryKeys.legacyLectureDetail });
      qc.invalidateQueries({ queryKey: teacherLectureQueryKeys.attendanceMatrix(lectureId) });
      if (isEdit) qc.invalidateQueries({ queryKey: teacherLectureQueryKeys.sessionDetail(editData.id) });
      teacherToast.success(isEdit ? "차시가 수정되었습니다." : "차시가 추가되었습니다.");
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, isEdit ? "차시를 수정하지 못했습니다." : "차시를 추가하지 못했습니다.")),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteSession(editData?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherLectureQueryKeys.lectureSessions });
      qc.invalidateQueries({ queryKey: teacherLectureQueryKeys.legacyLectureDetail });
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

  const handleSave = () => {
    if (mutation.isPending) return;
    if (sessionType === "SUPPLEMENT" && !title.trim()) {
      teacherToast.error("보강 이름을 입력하세요.");
      return;
    }
    const order = regularOrder.trim();
    if (sessionType === "REGULAR" && order && (!/^[1-9]\d*$/.test(order) || !Number.isSafeInteger(Number(order)))) {
      teacherToast.error("차시 번호는 1 이상의 정수로 입력하세요.");
      return;
    }
    mutation.mutate();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? "차시 편집" : "차시 추가"}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        {!isEdit && (
          <div role="group" aria-label="차시 유형" className="grid grid-cols-2 gap-2">
            {(["REGULAR", "SUPPLEMENT"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={sessionType === kind}
                onClick={() => setSessionType(kind)}
                className="text-sm font-semibold cursor-pointer"
                style={{
                  minHeight: 44,
                  borderRadius: "var(--tc-radius-sm)",
                  border: "1px solid var(--tc-border-strong)",
                  background: sessionType === kind ? "var(--tc-primary)" : "var(--tc-surface-soft)",
                  color: sessionType === kind ? "#fff" : "var(--tc-text)",
                }}
              >
                {kind === "REGULAR" ? "정규 차시" : "보강"}
              </button>
            ))}
          </div>
        )}
        <div>
          <label htmlFor="mobile-session-title" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{sessionType === "SUPPLEMENT" ? "보강 이름 *" : "차시 이름 (선택)"}</label>
          <input id="mobile-session-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={sessionType === "SUPPLEMENT" ? "예: 토요일 심화 클리닉" : "예: 직보(직전보강)"}
            maxLength={255} disabled={mutation.isPending} aria-describedby="mobile-session-title-help"
            className="w-full text-sm"
            style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          <p id="mobile-session-title-help" className="mt-1 text-xs" style={{ color: "var(--tc-text-muted)" }}>
            {sessionType === "SUPPLEMENT"
              ? "이 이름으로 표시되며 정규 차시 번호는 늘어나지 않습니다."
              : "이름을 입력하면 번호 대신 표시됩니다. 비워 두면 번호로 표시되며, 정규 진도 번호와 유형은 유지됩니다."}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>날짜</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm"
              style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          </div>
          {sessionType === "REGULAR" && <div style={{ width: 80 }}>
            <label htmlFor="mobile-session-order" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>차시 번호</label>
            <input id="mobile-session-order" type="number" min={1} step={1} inputMode="numeric" value={regularOrder} onChange={(e) => setRegularOrder(e.target.value)} placeholder="자동"
              className="w-full text-sm"
              style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
          </div>}
        </div>

        <button onClick={handleSave} disabled={(sessionType === "SUPPLEMENT" && !title.trim()) || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-2"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: sessionType === "REGULAR" || title.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: sessionType === "REGULAR" || title.trim() ? "#fff" : "var(--tc-text-muted)" }}>
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
