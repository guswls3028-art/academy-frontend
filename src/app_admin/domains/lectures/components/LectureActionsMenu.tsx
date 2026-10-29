import { useEffect, useRef, useState } from "react";
import { Dropdown, type MenuProps } from "antd";
import { Archive, Loader2, Pencil, RotateCcw, Settings, Trash2 } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { deleteLecture, updateLecture } from "../api/sessions";
import "./LectureActionsMenu.css";

type Props = {
  lecture: { id: number; title: string };
  isPast: boolean;
  onEdit: (id: number) => void;
  onChanged: (action: "end" | "restore" | "delete") => void;
};

export default function LectureActionsMenu({ lecture, isPast, onEdit, onChanged }: Props) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Cancel pending focus when dismissed before the next frame. Dropdown's
    // deferred autoFocus can otherwise steal focus back after Escape or Edit.
    const frame = requestAnimationFrame(() => {
      if (!popup.current?.contains(document.activeElement)) {
        popup.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  async function act(action: "edit" | "end" | "restore" | "delete") {
    if (inFlight.current) return;
    setOpen(false);
    if (action === "edit") {
      onEdit(lecture.id);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (action !== "restore") {
        const accepted = await confirm({
          title: action === "end" ? "강의 종료" : "강의 삭제",
          message: action === "end"
            ? `“${lecture.title}” 강의를 종료하시겠습니까? 수강·출결 이력은 보관되며 지난 강의에서 복원할 수 있습니다.`
            : `“${lecture.title}” 강의를 완전히 삭제하시겠습니까? 차시·수강생·출결 등 모든 관련 정보가 제거됩니다.`,
          confirmText: action === "end" ? "종료" : "삭제",
          danger: true,
        });
        if (!accepted) return;
      }
      if (action === "delete") await deleteLecture(lecture.id);
      else await updateLecture(lecture.id, { is_active: action === "restore" });
      feedback.success(action === "end" ? "강의를 종료했습니다. 지난 강의에서 복원할 수 있습니다."
        : action === "restore" ? "강의를 복원했습니다." : "강의를 삭제했습니다.");
      onChanged(action);
    } catch (error) {
      feedback.error(extractApiError(error, "변경하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      inFlight.current = false;
      setBusy(false);
      trigger.current?.focus();
    }
  }

  const items: MenuProps["items"] = isPast ? [
    { key: "restore", label: "강의 복원", icon: <RotateCcw size={ICON.sm} aria-hidden /> },
    { type: "divider" },
    { key: "delete", label: "강의 삭제", danger: true, icon: <Trash2 size={ICON.sm} aria-hidden /> },
  ] : [
    { key: "edit", label: "강의 수정", icon: <Pencil size={ICON.sm} aria-hidden /> },
    { type: "divider" },
    { key: "end", label: "강의 종료", icon: <Archive size={ICON.sm} aria-hidden /> },
  ];

  return (
    <Dropdown
      open={open}
      onOpenChange={(next) => { if (!inFlight.current) setOpen(next); }}
      trigger={["click"]}
      placement="bottomRight"
      popupRender={(menu) => <div ref={popup}>{menu}</div>}
      classNames={{ root: "lecture-actions-dropdown" }}
      menu={{
        items,
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === "edit" || key === "end" || key === "restore" || key === "delete") void act(key);
        },
        onKeyDown: (event) => {
          if (event.key === "Escape" || event.key === "Tab") {
            // Own dismissal before the library's window handler can refocus
            // its overlay; Tab retains the browser's normal next/previous step.
            event.stopPropagation();
            if (event.key === "Escape") event.preventDefault();
            setOpen(false);
            trigger.current?.focus();
          }
        },
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="lecture-actions-trigger"
        aria-label={`${lecture.title} 설정`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={busy}
        disabled={busy}
        title={busy ? "처리 중…" : "강의 설정"}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
        }}
      >
        {busy ? <Loader2 size={ICON.md} className="lecture-actions-spinner" aria-hidden />
          : <Settings size={ICON.md} aria-hidden />}
      </button>
    </Dropdown>
  );
}
