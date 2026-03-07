import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Popover } from "antd";
import { Trash2, FolderOpen } from "lucide-react";

import api from "@/shared/api/axios";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { DatePicker } from "@/shared/ui/date";
import { TimeRangeInput } from "@/shared/ui/time";
import { ColorPickerField, getDefaultColorForPicker } from "@/shared/ui/domain";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { fetchLectureInstructorOptions } from "@/features/lectures/api/sessions";
import { feedback } from "@/shared/ui/feedback/feedback";
import { validateRequiredFields } from "@/shared/utils/modalValidation";
import "./LectureCreateModal.css";

const SAVED_SUBJECTS_KEY = "academy-lecture-saved-subjects";

function getSavedList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x: unknown): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveToList(key: string, name: string): string[] {
  const trimmed = (name || "").trim();
  if (!trimmed) return getSavedList(key);
  const list = getSavedList(key);
  if (list.includes(trimmed)) return list;
  const next = [...list, trimmed];
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function removeFromList(key: string, name: string): string[] {
  const list = getSavedList(key).filter((x) => x !== name);
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usedColors?: string[];
}

interface CreateLecturePayload {
  title: string;
  name: string;
  subject: string;
  description: string;
  start_date: string;
  end_date?: string | null;
  lecture_time: string;
  color: string;
  chip_label: string;
  is_active: boolean;
}

export default function LectureCreateModal({ isOpen, onClose, usedColors = [] }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lectureTime, setLectureTime] = useState("");
  const [color, setColor] = useState(() => getDefaultColorForPicker(usedColors));
  const [chipLabel, setChipLabel] = useState("");

  const [savedSubjects, setSavedSubjects] = useState<string[]>(() => getSavedList(SAVED_SUBJECTS_KEY));
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);
  const [instructorPopoverOpen, setInstructorPopoverOpen] = useState(false);
  const [addSubjectInput, setAddSubjectInput] = useState("");
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const modalTitle = useMemo(() => "강의 추가", []);

  const { data: instructorOptions = [] } = useQuery({
    queryKey: ["lecture-instructor-options"],
    queryFn: fetchLectureInstructorOptions,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen && instructorOptions.length > 0 && !name) {
      setName(instructorOptions[0]?.name ?? "");
    }
  }, [isOpen, instructorOptions, name]);

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
    setAddSubjectInput("");
    setHasAttemptedSubmit(false);
  }, [isOpen, usedColors]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      const isTextarea = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (e.key === "Enter" && !isTextarea && !isPending) {
        e.preventDefault();
        submit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isPending, title, name, subject, description, startDate, endDate, lectureTime, color, chipLabel]);

  if (!isOpen) return null;

  const effectiveChipLabel = (chipLabel.trim() || title.trim().slice(0, 2)).slice(0, 2);

  function submit() {
    setHasAttemptedSubmit(true);
    const err = validateRequiredFields([
      { value: title, label: "강의 이름" },
      { value: name, label: "담당 강사" },
      { value: subject, label: "과목" },
      { value: startDate, label: "시작일" },
      { value: lectureTime, label: "강의 시간", message: "강의 시작·종료 시간을 선택해 주세요." },
    ]);
    if (err) {
      feedback.error(err);
      return;
    }

    const trimmedSubject = subject.trim();
    if (trimmedSubject) setSavedSubjects(saveToList(SAVED_SUBJECTS_KEY, trimmedSubject));

    const payload: CreateLecturePayload = {
      title: title.trim(),
      name: name.trim(),
      subject: subject.trim(),
      description: description.trim(),
      start_date: startDate.trim(),
      lecture_time: lectureTime.trim(),
      color,
      chip_label: effectiveChipLabel,
      is_active: true,
    };
    if (endDate.trim()) payload.end_date = endDate.trim();
    mutate(payload);
  }

  const subjectPopoverContent = (
    <div className="saved-list-field-popover">
      {savedSubjects.length === 0 ? (
        <div className="saved-list-field-popover-empty">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">저장된 과목이 없습니다.</p>
          <div className="flex gap-2">
            <input
              type="text"
              className="ds-input flex-1 min-w-0"
              placeholder="과목 입력"
              value={addSubjectInput}
              onChange={(e) => setAddSubjectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = addSubjectInput.trim();
                  if (v) {
                    setSavedSubjects(saveToList(SAVED_SUBJECTS_KEY, v));
                    setSubject(v);
                    setAddSubjectInput("");
                    setSubjectPopoverOpen(false);
                    feedback.success("추가됨");
                  }
                }
              }}
            />
            <Button
              size="sm"
              intent="primary"
              onClick={() => {
                const v = addSubjectInput.trim();
                if (v) {
                  setSavedSubjects(saveToList(SAVED_SUBJECTS_KEY, v));
                  setSubject(v);
                  setAddSubjectInput("");
                  setSubjectPopoverOpen(false);
                  feedback.success("추가됨");
                }
              }}
            >
              추가
            </Button>
          </div>
        </div>
      ) : (
        <div className="saved-list-field-popover-list">
          {savedSubjects.map((loc) => (
            <div key={loc} className="saved-list-field-popover-item-row">
              <button
                type="button"
                className="saved-list-field-popover-item flex-1 min-w-0 text-left"
                onClick={() => {
                  setSubject(loc);
                  setSubjectPopoverOpen(false);
                }}
              >
                {loc}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSavedSubjects(removeFromList(SAVED_SUBJECTS_KEY, loc));
                  feedback.success("삭제됨");
                }}
                className="saved-list-field-popover-delete"
                title="과목 삭제"
                aria-label={`${loc} 삭제`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="border-t border-[var(--color-border-divider)] mt-2 pt-2">
            <p className="text-[11px] text-[var(--color-text-muted)] mb-1">과목 추가하기</p>
            <div className="flex gap-2">
              <input
                type="text"
                className="ds-input flex-1 min-w-0 text-sm"
                placeholder="새 과목"
                value={addSubjectInput}
                onChange={(e) => setAddSubjectInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = addSubjectInput.trim();
                    if (v) {
                      setSavedSubjects(saveToList(SAVED_SUBJECTS_KEY, v));
                      setSubject(v);
                      setAddSubjectInput("");
                      setSubjectPopoverOpen(false);
                      feedback.success("추가됨");
                    }
                  }
                }}
              />
              <Button
                size="sm"
                intent="secondary"
                onClick={() => {
                  const v = addSubjectInput.trim();
                  if (v) {
                    setSavedSubjects(saveToList(SAVED_SUBJECTS_KEY, v));
                    setSubject(v);
                    setAddSubjectInput("");
                    setSubjectPopoverOpen(false);
                    feedback.success("추가됨");
                  }
                }}
              >
                추가
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const instructorList = useMemo(
    () => [...new Set(instructorOptions.map((o) => o.name).filter(Boolean))],
    [instructorOptions]
  );

  const instructorPopoverContent = (
    <div className="saved-list-field-popover">
      {instructorList.length === 0 ? (
        <div className="saved-list-field-popover-empty">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">등록된 담당 강사가 없습니다.</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">직원관리에서 강사를 추가해 주세요.</p>
          <Button
            size="sm"
            intent="primary"
            onClick={() => {
              setInstructorPopoverOpen(false);
              onClose();
              navigate("/admin/staff");
            }}
          >
            직원관리로 이동
          </Button>
        </div>
      ) : (
        <div className="saved-list-field-popover-list">
          {instructorList.map((instructorName) => (
            <div key={instructorName} className="saved-list-field-popover-item-row">
              <button
                type="button"
                className="saved-list-field-popover-item flex-1 min-w-0 text-left"
                onClick={() => {
                  setName(instructorName);
                  setInstructorPopoverOpen(false);
                }}
              >
                {instructorName}
              </button>
            </div>
          ))}
          <div className="border-t border-[var(--color-border-divider)] mt-2 pt-2">
            <p className="text-[11px] text-[var(--color-text-muted)] mb-1">담당 강사 추가·삭제는 직원관리에서 합니다.</p>
            <Button
              size="sm"
              intent="secondary"
              className="w-full"
              onClick={() => {
                setInstructorPopoverOpen(false);
                onClose();
                navigate("/admin/staff");
              }}
            >
              직원관리로 이동
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={480}>
      <ModalHeader type="action" title={modalTitle} />

      <ModalBody>
        {isError && (
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 900, color: "var(--color-error)" }}>
            등록 중 오류가 발생했습니다.
          </div>
        )}

        <div className="lecture-create-modal-form" style={{ display: "grid", gap: 10, maxWidth: 400 }}>
          {/* 딱지 영역 */}
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
                chipLabel={effectiveChipLabel || undefined}
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

          {/* 강의 이름 — 필수, 라벨 없이 placeholder로 표시 */}
          <div className="modal-form-group">
            <input
              className="ds-input"
              placeholder="강의 이름 (필수)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-required="true"
              data-invalid={hasAttemptedSubmit && !title.trim() ? "true" : "false"}
              disabled={isPending}
              autoFocus
              aria-label="강의 이름 (필수)"
            />
          </div>

          {/* 담당 강사 · 과목 — 라벨 없이 placeholder로 표시 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "stretch" }}>
            <div className="modal-form-group">
              <Popover
                open={instructorPopoverOpen}
                onOpenChange={(open) => {
                  setInstructorPopoverOpen(open);
                }}
                trigger="click"
                placement="bottomLeft"
                content={instructorPopoverContent}
              >
                <input
                  type="text"
                  readOnly
                  className="ds-input w-full min-w-0"
                  placeholder="담당 강사 (필수)"
                  value={name}
                  data-required="true"
                  data-invalid={hasAttemptedSubmit && !name.trim() ? "true" : "false"}
                  disabled={isPending}
                  aria-label="담당 강사 (필수)"
                  style={{ cursor: "pointer", caretColor: "transparent" }}
                />
              </Popover>
            </div>
            <div className="modal-form-group">
              <div className="flex gap-2 items-center min-w-0">
                <input
                  type="text"
                  className="ds-input flex-1 min-w-0"
                  placeholder="과목 (필수)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  data-required="true"
                  data-invalid={hasAttemptedSubmit && !subject.trim() ? "true" : "false"}
                  disabled={isPending}
                  aria-label="과목 (필수)"
                />
                <Popover
                  open={subjectPopoverOpen}
                  onOpenChange={(open) => {
                    setSubjectPopoverOpen(open);
                    if (open) setSavedSubjects(getSavedList(SAVED_SUBJECTS_KEY));
                  }}
                  trigger="click"
                  placement="bottomLeft"
                  content={subjectPopoverContent}
                >
                  <button
                    type="button"
                    className="saved-list-field-icon-btn"
                    title="저장된 과목 불러오기"
                    aria-label="저장된 과목 불러오기"
                  >
                    <FolderOpen size={16} />
                  </button>
                </Popover>
              </div>
            </div>
          </div>

          {/* 설명 — 라벨 없이 placeholder로 표시 */}
          <div className="modal-form-group modal-form-group--neutral">
            <textarea
              className="ds-textarea w-full"
              rows={3}
              placeholder="설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              style={{ resize: "none" }}
              aria-label="설명"
            />
          </div>

          {/* 시작일(필수) · 종료일(선택) — 라벨 없이 placeholder로 표시 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="modal-form-group" data-required="true" data-invalid={hasAttemptedSubmit && !startDate.trim() ? "true" : "false"}>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="시작일 (필수)"
                disabled={isPending}
              />
            </div>
            <div className="modal-form-group modal-form-group--neutral">
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="종료일 (선택)"
                disabled={isPending}
              />
            </div>
          </div>

          {/* 강의 시간 — 외부 블록 없이 TimeRangeInput만 (시작/종료 카드만 표시) */}
          <div data-required="true" data-invalid={hasAttemptedSubmit && !lectureTime.trim() ? "true" : "false"}>
            <TimeRangeInput
              value={lectureTime}
              onChange={setLectureTime}
              disabled={isPending}
              startPlaceholder="시작 시간"
              endPlaceholder="종료 시간"
              startLabel="시작"
              endLabel="종료"
            />
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button intent="primary" onClick={submit} disabled={isPending}>
              {isPending ? "등록 중…" : "등록"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
