// PATH: src/features/students/components/StudentFilterModal.tsx
import { useEffect, useMemo, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: any;
  onApply: (next: any) => void;
}

function normalize(next: any) {
  Object.keys(next).forEach((k) => {
    const v = next[k];
    if (v === "" || v == null) delete next[k];
  });

  if (typeof next.is_managed === "string") {
    if (next.is_managed === "true") next.is_managed = true;
    else if (next.is_managed === "false") next.is_managed = false;
    else delete next.is_managed;
  }

  if (typeof next.grade === "string" && next.grade.trim()) {
    const n = Number(next.grade);
    if (Number.isFinite(n)) next.grade = n;
    else delete next.grade;
  }

  if (typeof next.school_type === "string" && !next.school_type.trim()) {
    delete next.school_type;
  }

  return next;
}

export default function StudentFilterModal({
  open,
  onClose,
  filters,
  onApply,
}: Props) {
  const [local, setLocal] = useState<any>(filters || {});
  const title = useMemo(() => "고급 필터", []);

  useEffect(() => {
    if (!open) return;
    setLocal(filters || {});
  }, [open, filters]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function update(key: string, value: any) {
    setLocal((prev: any) => ({ ...prev, [key]: value }));
  }

  function apply() {
    const next = normalize({ ...local });
    onApply(next);
  }

  function reset() {
    setLocal({});
  }

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.md}>
      <ModalHeader
        type="action"
        title={title}
        description="조건에 맞는 학생만 조회합니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          <div className="modal-form-row modal-form-row--3">
            <select
              className="ds-select"
              value={local.school_type ?? ""}
              onChange={(e) => update("school_type", e.target.value)}
            >
              <option value="">학교급 전체</option>
              <option value="HIGH">고등</option>
              <option value="MIDDLE">중등</option>
            </select>
            <select
              className="ds-select"
              value={local.is_managed ?? ""}
              onChange={(e) => update("is_managed", e.target.value)}
            >
              <option value="">상태 전체</option>
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
            <select
              className="ds-select"
              value={local.gender || ""}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option value="">성별 전체</option>
              <option value="M">남</option>
              <option value="F">여</option>
            </select>
          </div>
          <div className="modal-form-row modal-form-row--3">
            <input
              className="ds-input"
              placeholder="아이디"
              value={local.ps_number || ""}
              onChange={(e) => update("ps_number", e.target.value)}
            />
            <input
              className="ds-input"
              placeholder="OMR 식별자 (8자리)"
              value={local.omr_code || ""}
              onChange={(e) => update("omr_code", e.target.value)}
            />
            <input
              className="ds-input"
              placeholder="이름"
              value={local.name || ""}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div className="modal-form-row modal-form-row--3">
            <input
              className="ds-input"
              placeholder="계열(major)"
              value={local.major || ""}
              onChange={(e) => update("major", e.target.value)}
            />
            <input
              className="ds-input"
              placeholder="고등학교"
              value={local.high_school || ""}
              onChange={(e) => update("high_school", e.target.value)}
            />
            <input
              className="ds-input"
              placeholder="중학교"
              value={local.middle_school || ""}
              onChange={(e) => update("middle_school", e.target.value)}
            />
          </div>
          <div className="modal-form-row modal-form-row--1-auto">
            <select
              className="ds-select"
              value={local.grade ?? ""}
              onChange={(e) => update("grade", e.target.value)}
              style={{ maxWidth: "12rem" }}
            >
              <option value="">학년 전체</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
            </select>
            <span className="modal-hint" style={{ marginBottom: 0 }}>
              필터는 서버 조회에 반영되며, 빈 값은 자동 제거됩니다.
            </span>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <Button intent="ghost" onClick={reset}>
            초기화
          </Button>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose}>
              취소
            </Button>
            <Button intent="primary" onClick={apply}>
              적용
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
