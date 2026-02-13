// PATH: src/features/lectures/components/DdayModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDday } from "../api/ddays";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";

interface Props {
  lectureId: number;
  onClose: () => void;
}

export default function DdayModal({ lectureId, onClose }: Props) {
  const qc = useQueryClient();

  const [titleInput, setTitleInput] = useState("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("12:00");
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => "D-Day 추가", []);

  const { mutate } = useMutation({
    mutationFn: async () => {
      setBusy(true);
      try {
        const iso = date && time ? `${date}T${time}:00` : `${date}T00:00:00`;
        return await createDday({ lecture: lectureId, title: titleInput, date: iso });
      } finally {
        setBusy(false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ddays", lectureId] });
      onClose();
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!busy && titleInput.trim() && date) mutate();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, titleInput, date, time]);

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={720}>
      <ModalHeader type="action" title={title} description="⌘/Ctrl + Enter 로 저장" />

      <ModalBody>
        <div style={{ display: "grid", gap: 12 }}>
          <input
            className="ds-input"
            placeholder="제목"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            disabled={busy}
            data-invalid={!titleInput.trim() ? "true" : "false"}
            autoFocus
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
            <input
              type="date"
              className="ds-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
              data-invalid={!date ? "true" : "false"}
            />
            <input
              type="time"
              className="ds-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={busy}
            />
          </div>

          <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
            날짜는 필수입니다.
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
            ESC 로 닫기 · ⌘/Ctrl + Enter 저장
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={() => {
                if (!titleInput.trim() || !date) return;
                mutate();
              }}
              disabled={busy || !titleInput.trim() || !date}
            >
              {busy ? "저장 중…" : "추가"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
