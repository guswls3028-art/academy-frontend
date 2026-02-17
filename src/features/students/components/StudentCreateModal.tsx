// PATH: src/features/students/components/StudentCreateModal.tsx
// 엑셀 일괄 등록: 워커 전담 (파일 업로드 → excel_parsing job → 폴링). 프론트 파싱/청크 제거.

import { useEffect, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button, Tabs } from "@/shared/ui/ds";
import {
  formatPhoneForInput,
  parsePhoneInput,
} from "@/shared/utils/phoneInput";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import { createStudent, uploadStudentBulkFromExcel } from "../api/students";
import { downloadStudentExcelTemplate } from "../excel/studentExcel";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import { feedback } from "@/shared/ui/feedback/feedback";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onBulkProgress?: (progress: { current: number; total: number } | null) => void;
}

const TAB_ITEMS = [
  { key: "single", label: "1명만 등록" },
  { key: "excel", label: "엑셀로 업로드" },
];

export default function StudentCreateModal({ open, onClose, onSuccess, onBulkProgress }: Props) {
  const [activeTab, setActiveTab] = useState("single");
  const [busy, setBusy] = useState(false);
  const [excelBulkPassword, setExcelBulkPassword] = useState("");
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);

  const [sendWelcomeMessage, setSendWelcomeMessage] = useState(false);
  const [form, setForm] = useState({
    name: "",
    gender: "",
    initialPassword: "",
    studentPhone: "",
    omrCode: "",
    parentPhone: "",
    schoolType: "HIGH",
    school: "",
    grade: "",
    schoolClass: "",
    major: "",
    memo: "",
    active: true,
  });

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && activeTab === "single") handleSubmit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, form, busy, activeTab]);

  useEffect(() => {
    if (!open) return;
    setActiveTab("single");
    setBusy(false);
    onBulkProgress?.(null);
    setExcelBulkPassword("");
    setSelectedExcelFile(null);
    setSendWelcomeMessage(false);
    setForm({
      name: "",
      gender: "",
      initialPassword: "",
      studentPhone: "",
      omrCode: "",
      parentPhone: "",
      schoolType: "HIGH",
      school: "",
      grade: "",
      schoolClass: "",
      major: "",
      memo: "",
      active: true,
    });
  }, [open, onBulkProgress]);

  function handleExcelFileSelect(file: File) {
    setSelectedExcelFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((p) => {
      const next = { ...p, [name]: value };
      if (name === "school") {
        const t = String(value ?? "").trim();
        if (t.endsWith("고")) next.schoolType = "HIGH";
        else if (t.endsWith("중")) next.schoolType = "MIDDLE";
      }
      return next;
    });
  }

  function handlePhoneChange(name: "studentPhone" | "parentPhone", value: string) {
    const raw = parsePhoneInput(value);
    setForm((p) => ({ ...p, [name]: raw }));
  }

  function validate(): string | null {
    // 필수: 이름, 초기비밀번호, 학부모 전화번호 (학생 전화는 선택, 없으면 부모 전화 8자리로 OMR)
    if (!String(form.name || "").trim()) return "이름을 입력해 주세요.";
    if (!String(form.initialPassword || "").trim()) return "초기 비밀번호를 입력해 주세요.";

    const parent = String(form.parentPhone || "").trim();
    if (!parent) return "학부모 전화번호를 입력해 주세요.";
    if (!/^010\d{8}$/.test(parent)) return "학부모 전화번호는 010XXXXXXXX 형식이어야 합니다.";

    const phone = String(form.studentPhone || "").trim();
    if (phone && !/^010\d{8}$/.test(phone)) return "학생 전화번호는 010XXXXXXXX 형식이어야 합니다.";

    return null;
  }

  async function handleSubmit() {
    if (busy) return;

    const err = validate();
    if (err) return alert(err);

    setBusy(true);
    try {
      await createStudent({ ...form, noPhone: !String(form.studentPhone || "").trim(), sendWelcomeMessage });
      onSuccess();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleExcelRegister() {
    if (busy || !selectedExcelFile) return;
    const pwd = String(excelBulkPassword || "").trim();
    if (!pwd || pwd.length < 4) {
      feedback.error("초기 비밀번호를 4자 이상 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const { job_id } = await uploadStudentBulkFromExcel(selectedExcelFile, pwd);
      if (!job_id) {
        feedback.error("작업 ID를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      asyncStatusStore.addWorkerJob("학생 일괄 등록", job_id, "excel_parsing");
      feedback.success("백그라운드에서 진행됩니다. 우하단에서 진행 상황을 확인할 수 있습니다.");
      onSuccess();
      onClose();
    } catch (e: unknown) {
      feedback.error(e instanceof Error ? e.message : "등록 요청 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.md}>
      <ModalHeader
        type="action"
        title="학생 등록"
        description={activeTab === "single" ? "⌘/Ctrl + Enter 로 등록" : "엑셀 파일로 학생을 일괄 등록합니다"}
      />

      <div className="modal-tabs-area">
        <Tabs value={activeTab} items={TAB_ITEMS} onChange={setActiveTab} />
        <label className="modal-section-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-3)", marginBottom: 0, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={Boolean(sendWelcomeMessage)}
            onChange={(e) => setSendWelcomeMessage(e.target.checked)}
            disabled={busy}
          />
          등록완료 후 학부모, 학생에게 가입성공 메세지 일괄발송
        </label>
      </div>

      <ModalBody key={activeTab}>
        {activeTab === "single" ? (
        <div className="modal-scroll-body modal-scroll-body--compact">
          {/* 필수 입력 — 세션 모달과 동일 구조·입체감 */}
          <div className="modal-form-group">
            <span className="modal-section-label">필수 입력</span>
            <input
              name="name"
              placeholder="이름"
              value={form.name ?? ""}
              onChange={handleChange}
              className="ds-input"
              data-required="true"
              data-invalid={!String(form.name || "").trim() ? "true" : "false"}
              disabled={busy}
              autoFocus
            />
            <input
              name="initialPassword"
              type="password"
              placeholder="초기 비밀번호"
              value={form.initialPassword ?? ""}
              onChange={handleChange}
              className="ds-input"
              data-required="true"
              data-invalid={!String(form.initialPassword || "").trim() ? "true" : "false"}
              disabled={busy}
            />
            <input
              placeholder="학부모 전화 (010-XXXX-XXXX)"
              value={formatPhoneForInput(form.parentPhone ?? "")}
              onChange={(e) => handlePhoneChange("parentPhone", e.target.value)}
              className="ds-input"
              data-required="true"
              data-invalid={!String(form.parentPhone || "").trim() ? "true" : "false"}
              disabled={busy}
              maxLength={13}
              inputMode="numeric"
              pattern="[0-9\-]*"
            />
          </div>

          {/* 선택 입력 — 강조색 없음, 입체감만 유지 */}
          <div className="modal-form-group modal-form-group--neutral">
            <span className="modal-section-label">선택 입력</span>
            <div className="modal-form-row modal-form-row--1-auto">
              <input
                placeholder="학생 전화 (없으면 부모 전화로 OMR)"
                value={formatPhoneForInput(form.studentPhone ?? "")}
                onChange={(e) => handlePhoneChange("studentPhone", e.target.value)}
                className="ds-input"
                disabled={busy}
                maxLength={13}
                inputMode="numeric"
                pattern="[0-9\-]*"
              />
              <div className="modal-actions-inline" style={{ height: 36 }}>
                {[{ key: "M", label: "남자" }, { key: "F", label: "여자" }].map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    className={`student-gender-btn student-gender-btn--${g.key === "M" ? "m" : "f"}${form.gender === g.key ? " is-selected" : ""}`}
                    aria-pressed={form.gender === g.key}
                    onClick={() => setForm((p) => ({ ...p, gender: g.key }))}
                    disabled={busy}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-form-row modal-form-row--1-auto-auto">
              <input
                name="school"
                placeholder="학교명 (XX고·XX중 입력 시 자동 선택)"
                value={form.school ?? ""}
                onChange={handleChange}
                className="ds-input"
                disabled={busy}
              />
              <div className="modal-actions-inline" style={{ height: 36 }}>
                <button
                  type="button"
                  className={`ds-choice-btn ds-choice-btn--primary${form.schoolType === "HIGH" ? " is-selected" : ""}`}
                  aria-pressed={form.schoolType === "HIGH"}
                  onClick={() => setForm((p) => ({ ...p, schoolType: "HIGH" }))}
                  disabled={busy}
                >
                  고등
                </button>
                <button
                  type="button"
                  className={`ds-choice-btn ds-choice-btn--primary${form.schoolType === "MIDDLE" ? " is-selected" : ""}`}
                  aria-pressed={form.schoolType === "MIDDLE"}
                  onClick={() => setForm((p) => ({ ...p, schoolType: "MIDDLE" }))}
                  disabled={busy}
                >
                  중등
                </button>
              </div>
              <div className="modal-actions-inline" style={{ height: 36 }}>
                {["1", "2", "3"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`ds-choice-btn ds-choice-btn--primary${form.grade === g ? " is-selected" : ""}`}
                    aria-pressed={form.grade === g}
                    onClick={() => setForm((p) => ({ ...p, grade: g }))}
                    disabled={busy}
                  >
                    {g}학년
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-form-row modal-form-row--2">
              <input
                name="schoolClass"
                placeholder="반"
                value={form.schoolClass ?? ""}
                onChange={handleChange}
                className="ds-input"
                disabled={busy}
              />
              <input
                name="major"
                placeholder="계열(고등만)"
                value={form.major ?? ""}
                onChange={handleChange}
                className="ds-input"
                disabled={busy}
              />
            </div>
            <textarea
              name="memo"
              rows={3}
              placeholder="메모"
              value={form.memo ?? ""}
              onChange={handleChange}
              className="ds-textarea"
              disabled={busy}
            />
          </div>

          <div className="modal-form-row modal-form-row--1-auto">
            <span className="modal-hint modal-hint--block" style={{ marginBottom: 0 }}>
              등록 후 상세에서 태그/메모/상태를 관리할 수 있습니다.
            </span>
            <button
              type="button"
              className="ds-status-badge"
              data-status={form.active ? "active" : "inactive"}
              aria-pressed={form.active}
              onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
              disabled={busy}
            >
              {form.active ? "활성" : "비활성"}
            </button>
          </div>
        </div>
        ) : (
        <div className="modal-scroll-body modal-scroll-body--compact" style={{ display: "flex", flexDirection: "column" }}>
          <div className="modal-form-row modal-form-row--1-auto" style={{ alignItems: "end" }}>
            <div>
              <label className="modal-section-label">초기 비밀번호 (일괄)</label>
              <input
                type="password"
                placeholder="모든 학생에 적용할 초기 비밀번호 (4자 이상)"
                value={excelBulkPassword ?? ""}
                onChange={(e) => setExcelBulkPassword(e.target.value)}
                className="ds-input"
                disabled={busy}
                style={{ width: "100%" }}
              />
            </div>
            <Button intent="secondary" onClick={downloadStudentExcelTemplate} disabled={busy}>
              엑셀 양식 다운로드
            </Button>
          </div>

          <ExcelUploadZone onFileSelect={handleExcelFileSelect} disabled={busy} />

          {selectedExcelFile && (
            <div className="modal-form-group modal-form-group--row" style={{ justifyContent: "space-between" }}>
              <span className="modal-section-label" style={{ marginBottom: 0 }}>
                선택된 파일: {selectedExcelFile.name}
              </span>
              <Button
                intent="ghost"
                size="sm"
                onClick={() => setSelectedExcelFile(null)}
                disabled={busy}
              >
                취소
              </Button>
            </div>
          )}
        </div>
        )}
      </ModalBody>

      <ModalFooter
        left={
          <span className="modal-hint" style={{ marginBottom: 0 }}>
            {activeTab === "single"
              ? "⌘/Ctrl + Enter 등록"
              : selectedExcelFile
              ? "초기 비밀번호 입력 후 등록"
              : "엑셀 파일 선택 후 등록"}
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            {activeTab === "single" && (
              <Button intent="primary" onClick={handleSubmit} disabled={busy}>
                {busy ? "등록 중…" : "등록"}
              </Button>
            )}
            {activeTab === "excel" && selectedExcelFile && (
              <Button intent="primary" onClick={handleExcelRegister} disabled={busy}>
                {busy ? "등록 중…" : "등록"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
