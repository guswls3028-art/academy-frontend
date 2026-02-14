import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";
import { ColorPickerField, getDefaultColorForPicker } from "@/shared/ui/domain";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 이미 사용 중인 강의 색상 — 기본값이 이들과 최대한 차이나도록 선택됨 */
  usedColors?: string[];
}

interface CreateLecturePayload {
  title: string;
  name: string;
  subject: string;
  description: string;
  start_date: string;
  end_date: string;
  lecture_time: string;
  color: string;
  chip_label: string;
  is_active: boolean;
}

export default function LectureCreateModal({ isOpen, onClose, usedColors = [] }: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lectureTime, setLectureTime] = useState("");
  const [color, setColor] = useState(() => getDefaultColorForPicker(usedColors));
  const [chipLabel, setChipLabel] = useState("");

  const modalTitle = useMemo(() => "강의 추가", []);

  const { mutate, isPending, isError } = useMutation({
    mutationFn: async (payload: CreateLecturePayload) => {
      await api.post("/lectures/lectures/", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lectures"] });
      onClose();
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setName("");
    setSubject("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setLectureTime("");
    setColor(getDefaultColorForPicker(usedColors));
    setChipLabel("");
  }, [isOpen, usedColors]);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!isPending && title.trim()) submit();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, title, name, subject, description, startDate, endDate, lectureTime, color, chipLabel, isPending]);

  if (!isOpen) return null;

  function submit() {
    if (!title.trim()) return;
    mutate({
      title,
      name,
      subject,
      description,
      start_date: startDate,
      end_date: endDate,
      lecture_time: lectureTime.trim(),
      color,
      chip_label: chipLabel.trim().slice(0, 2),
      is_active: true,
    });
  }

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={820}>
      <ModalHeader type="action" title={modalTitle} description="⌘/Ctrl + Enter 로 등록" />

      <ModalBody>
        {isError && (
          <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 900, color: "var(--color-error)" }}>
            등록 중 오류가 발생했습니다.
          </div>
        )}

        {/* ⬇️ students 모달과 동일한 입력 래퍼 구조 */}
        <div style={{ display: "grid", gap: 12 }}>
          <input
            className="ds-input"
            placeholder="강의 이름"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-invalid={!title.trim() ? "true" : "false"}
            disabled={isPending}
            autoFocus
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              className="ds-input"
              placeholder="담당 강사"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
            <input
              className="ds-input"
              placeholder="과목"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isPending}
            />
          </div>

          <textarea
            className="ds-textarea"
            rows={5}
            placeholder="설명"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            style={{ resize: "none" }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="시작일"
              disabled={isPending}
            />
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="종료일"
              disabled={isPending}
            />
          </div>

          <input
            className="ds-input"
            placeholder="강의 시간 (예: 토 12:00 ~ 13:00)"
            value={lectureTime}
            onChange={(e) => setLectureTime(e.target.value)}
            disabled={isPending}
          />

          <ColorPickerField
            label="아이콘 색상"
            value={color}
            onChange={setColor}
            disabled={isPending}
          />

          <input
            className="ds-input"
            placeholder="딱지 (2글자, 선택) — 미입력 시 강의 이름 앞 2자"
            value={chipLabel}
            onChange={(e) => setChipLabel(e.target.value.slice(0, 2))}
            maxLength={2}
            disabled={isPending}
            style={{ maxWidth: 160 }}
          />
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
            ESC 로 닫기 · ⌘/Ctrl + Enter 등록
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button intent="primary" onClick={submit} disabled={isPending || !title.trim()}>
              {isPending ? "등록 중…" : "등록"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
