import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";
import { TimeRangeInput } from "@/shared/ui/time";
import { ColorPickerField, getDefaultColorForPicker } from "@/shared/ui/domain";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchLectureInstructorOptions } from "@/features/lectures/api/sessions";

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

  const { data: instructorOptions = [] } = useQuery({
    queryKey: ["lecture-instructor-options"],
    queryFn: fetchLectureInstructorOptions,
    enabled: isOpen,
  });

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
    if (isOpen && instructorOptions.length > 0 && !name) {
      setName(instructorOptions[0].name);
    }
  }, [isOpen, instructorOptions, name]);

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
    <AdminModal open={true} onClose={onClose} type="action" width={480}>
      <ModalHeader type="action" title={modalTitle} description="⌘/Ctrl + Enter 로 등록" />

      <ModalBody>
        {isError && (
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 900, color: "var(--color-error)" }}>
            등록 중 오류가 발생했습니다.
          </div>
        )}

        <div style={{ display: "grid", gap: 10, maxWidth: 400 }}>
          {/* 딱지 영역: 좌측=미리보기+아이콘, 우측=팔레트 (방향 고정) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gridTemplateRows: "auto auto",
              gap: "10px 14px",
              alignItems: "center",
              direction: "ltr",
            }}
          >
            <div style={{ gridColumn: 1, gridRow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LectureChip
                lectureName=""
                color={color}
                chipLabel={chipLabel || undefined}
                size={36}
              />
            </div>
            <div style={{ gridColumn: 2, gridRow: "1 / -1", minWidth: 0 }}>
              <ColorPickerField
                label=""
                value={color}
                onChange={setColor}
                disabled={isPending}
              />
            </div>
            <div style={{ gridColumn: 1, gridRow: 2 }}>
              <input
                className="ds-input"
                placeholder="아이콘"
                value={chipLabel}
                onChange={(e) => setChipLabel(e.target.value.slice(0, 2))}
                maxLength={2}
                disabled={isPending}
                style={{ width: 56, textAlign: "center", padding: "6px 4px" }}
                aria-label="아이콘(딱지 2글자)"
              />
            </div>
          </div>

          <input
            className="ds-input"
            placeholder="강의 이름"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-invalid={!title.trim() ? "true" : "false"}
            disabled={isPending}
            autoFocus
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="modal-section-label" style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text-muted)" }}>
                담당 강사
              </label>
              <select
                className="ds-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                aria-label="담당 강사 선택"
              >
                <option value="">선택</option>
                {instructorOptions.map((opt) => (
                  <option key={`${opt.type}-${opt.name}`} value={opt.name}>
                    {opt.type === "owner" ? `오너 · ${opt.name}` : opt.name}
                  </option>
                ))}
              </select>
            </div>
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
            rows={3}
            placeholder="설명"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            style={{ resize: "none" }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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

          <div style={{ minWidth: 320 }}>
            <div className="modal-section-label" style={{ marginBottom: 6 }}>강의 시간</div>
            <TimeRangeInput
              value={lectureTime}
              onChange={setLectureTime}
              disabled={isPending}
              startPlaceholder="시작"
              endPlaceholder="종료"
              startLabel="시작"
              endLabel="종료"
            />
          </div>
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
