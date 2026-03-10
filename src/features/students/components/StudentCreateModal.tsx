// PATH: src/features/students/components/StudentCreateModal.tsx
// 차시생성 모달처럼 초기 선택(1명만 등록 / 엑셀 업로드) 후 해당 폼 표시. 엑셀 일괄 등록은 워커 전담.

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dropdown } from "antd";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import { createStudent, uploadStudentBulkFromExcel, bulkRestoreStudents, bulkPermanentDeleteStudents } from "../api/students";
import { downloadStudentExcelTemplate } from "../excel/studentExcel";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import { feedback } from "@/shared/ui/feedback/feedback";
import type { ClientStudent } from "../api/students";
import {
  fetchMessageTemplates,
  fetchAutoSendConfigs,
  updateAutoSendConfigs,
  createMessageTemplate,
  type AutoSendConfigItem,
  type AutoSendTrigger,
  type MessageTemplatePayload,
  type MessageMode,
} from "@/features/messages/api/messages.api";
import TemplateEditModal from "@/features/messages/components/TemplateEditModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onBulkProgress?: (progress: { current: number; total: number } | null) => void;
}

type RegisterMode = "choice" | "single" | "excel";

export default function StudentCreateModal({ open, onClose, onSuccess, onBulkProgress }: Props) {
  const [mode, setMode] = useState<RegisterMode>("choice");
  const [busy, setBusy] = useState(false);
  const [excelBulkPassword, setExcelBulkPassword] = useState("");
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [deletedStudentConflict, setDeletedStudentConflict] = useState<{ student: ClientStudent; formData: typeof form } | null>(null);

  const [sendWelcomeMessage, setSendWelcomeMessage] = useState(false);
  const [messageDropdownOpen, setMessageDropdownOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  /** 드롭다운 내 표시용 — 클릭 즉시 반영 후 API 호출 */
  const [localSignupMessageMode, setLocalSignupMessageMode] = useState<MessageMode>("alimtalk");
  const [localSignupTemplateId, setLocalSignupTemplateId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    psNumber: "",
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
    originMiddleSchool: "",
    address: "",
    memo: "",
    active: true,
  });

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      const isTextarea = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (e.key === "Enter" && !isTextarea && mode === "single") {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Enter" && !isTextarea && mode === "excel" && selectedExcelFile) {
        e.preventDefault();
        handleExcelRegister();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, form, busy, mode, selectedExcelFile]);

  useEffect(() => {
    if (!open) return;
    setMode("choice");
    setBusy(false);
    onBulkProgress?.(null);
    setExcelBulkPassword("");
    setSelectedExcelFile(null);
    setSendWelcomeMessage(false);
    setForm({
      name: "",
      psNumber: "",
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
      originMiddleSchool: "",
      address: "",
      memo: "",
      active: true,
    });
  }, [open, onBulkProgress]);

  const qc = useQueryClient();
  const needMessageConfig = open && (mode === "single" || mode === "excel");
  const { data: messageTemplates = [] } = useQuery({
    queryKey: ["messaging", "templates"],
    queryFn: () => fetchMessageTemplates(),
    enabled: needMessageConfig,
    staleTime: 30 * 1000,
  });
  const { data: autoSendConfigs = [] } = useQuery({
    queryKey: ["messaging", "auto-send"],
    queryFn: fetchAutoSendConfigs,
    enabled: needMessageConfig,
    staleTime: 30 * 1000,
  });
  const signupConfig = autoSendConfigs.find((c) => c.trigger === "student_signup") ?? null;

  useEffect(() => {
    if (messageDropdownOpen) {
      setLocalSignupMessageMode(signupConfig?.message_mode ?? "alimtalk");
      setLocalSignupTemplateId(signupConfig?.template ?? null);
    }
  }, [messageDropdownOpen, signupConfig?.message_mode, signupConfig?.template]);

  const updateAutoSendMut = useMutation({
    mutationFn: updateAutoSendConfigs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging", "auto-send"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "자동발송 설정 저장에 실패했습니다.";
      feedback.error(msg);
    },
  });

  const createTemplateAndRegisterMut = useMutation({
    mutationFn: async (payload: MessageTemplatePayload) => {
      const created = await createMessageTemplate(payload);
      const configs = await fetchAutoSendConfigs();
      const next = configs.map((c) =>
        c.trigger === "student_signup"
          ? { ...c, template: created.id, template_name: created.name, enabled: true }
          : c
      );
      await updateAutoSendConfigs(next);
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging", "templates"] });
      qc.invalidateQueries({ queryKey: ["messaging", "auto-send"] });
      setTemplateModalOpen(false);
      setMessageDropdownOpen(false);
      feedback.success("템플릿이 저장되었고, 가입 완료 시 자동 발송 메시지로 등록되었습니다.");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "템플릿 저장에 실패했습니다.";
      feedback.error(msg);
    },
  });

  function nextMessageMode(current: MessageMode, toggle: "sms" | "alimtalk"): MessageMode {
    const sms = current === "sms" || current === "both";
    const alim = current === "alimtalk" || current === "both";
    if (toggle === "sms") {
      const newSms = !sms;
      if (newSms && alim) return "both";
      if (newSms && !alim) return "sms";
      return "alimtalk";
    } else {
      const newAlim = !alim;
      if (sms && newAlim) return "both";
      if (!sms && newAlim) return "alimtalk";
      return "sms";
    }
  }

  function handleSetSignupMessageMode(toggle: "sms" | "alimtalk") {
    const nextMode = nextMessageMode(localSignupMessageMode, toggle);
    setLocalSignupMessageMode(nextMode);
    const configs: Partial<AutoSendConfigItem>[] = autoSendConfigs.map((c) =>
      c.trigger === "student_signup" ? { ...c, message_mode: nextMode } : c
    );
    updateAutoSendMut.mutate(configs);
  }

  function handleSelectSignupTemplateFromDropdown(templateId: number | null) {
    setLocalSignupTemplateId(templateId);
    const configs: Partial<AutoSendConfigItem>[] = autoSendConfigs.map((c) =>
      c.trigger === "student_signup"
        ? { ...c, template: templateId, enabled: templateId != null }
        : c
    );
    updateAutoSendMut.mutate(configs);
  }

  function handleTemplateSubmit(payload: MessageTemplatePayload) {
    createTemplateAndRegisterMut.mutate(payload);
  }

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

  function validate(): string | null {
    // 필수: 이름, 초기비밀번호, 학부모 전화번호 (학생 전화는 선택, 없으면 부모 전화 8자리로 OMR)
    if (!String(form.name || "").trim()) return "이름을 입력해 주세요.";
    if (!String(form.initialPassword || "").trim()) return "초기 비밀번호를 입력해 주세요.";

    const parent = String(form.parentPhone || "").trim();
    if (!parent || parent.length !== 11) return "학부모 전화번호를 입력해 주세요. (010 뒤 8자리)";
    if (!/^010\d{8}$/.test(parent)) return "학부모 전화번호는 010 뒤 8자리 숫자여야 합니다.";

    const phone = String(form.studentPhone || "").trim();
    if (phone.length > 0 && phone.length < 11) return "학생 전화는 비우거나 010 뒤 8자리를 입력해 주세요.";
    if (phone.length === 11 && !/^010\d{8}$/.test(phone)) return "학생 전화번호는 010 뒤 8자리 숫자여야 합니다.";

    return null;
  }

  async function handleSubmit() {
    if (busy) return;

    const err = validate();
    if (err) {
      feedback.error(err);
      return;
    }

    setBusy(true);
    try {
      const student = await createStudent({
        ...form,
        noPhone: !String(form.studentPhone || "").trim() || String(form.studentPhone || "").trim().length < 11,
        sendWelcomeMessage,
      });
      const loginId = (student?.psNumber ?? form.psNumber?.trim()) || "(자동 부여됨)";
      feedback.success(`등록 완료. 로그인 아이디: ${loginId} (초기 비밀번호로 로그인하세요)`);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { code?: string; deleted_student?: ClientStudent; detail?: unknown }; status?: number }; message?: string };
      if (err?.response?.status === 409 && err.response.data?.code === "deleted_student_exists" && err.response.data?.deleted_student) {
        const { mapStudent } = await import("../api/students");
        setDeletedStudentConflict({
          student: mapStudent(err.response.data.deleted_student),
          formData: { ...form },
        });
        setBusy(false);
        return;
      }
      const detail = err?.response?.data?.detail;
      let msg: string;
      if (typeof detail === "string") {
        msg = detail;
      } else if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        const parts = (Object.entries(detail) as [string, unknown][]).map(([k, v]) => {
          const val = Array.isArray(v) ? v.join(" ") : String(v ?? "");
          return val ? `${k}: ${val}` : k;
        });
        msg = parts.length ? parts.join("\n") : "입력값을 확인해 주세요.";
      } else if (detail) {
        msg = JSON.stringify(detail);
      } else {
        msg = err instanceof Error ? err.message : "등록 요청 중 오류가 발생했습니다.";
      }
      feedback.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreDeletedStudent() {
    if (!deletedStudentConflict || busy) return;
    setBusy(true);
    try {
      await bulkRestoreStudents([deletedStudentConflict.student.id]);
      feedback.success("학생이 복원되었습니다.");
      setDeletedStudentConflict(null);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      feedback.error(err?.response?.data?.detail || err?.message || "복원에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePermanentDeleteAndReregister() {
    if (!deletedStudentConflict || busy) return;
    setBusy(true);
    try {
      await bulkPermanentDeleteStudents([deletedStudentConflict.student.id]);
      const student = await createStudent({
        ...deletedStudentConflict.formData,
        noPhone: !String(deletedStudentConflict.formData.studentPhone || "").trim(),
        sendWelcomeMessage,
      });
      const loginId = (student?.psNumber ?? deletedStudentConflict.formData.psNumber?.trim()) || "(자동 부여됨)";
      feedback.success(`등록 완료. 로그인 아이디: ${loginId} (초기 비밀번호로 로그인하세요)`);
      setDeletedStudentConflict(null);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown }; status?: number }; message?: string };
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : detail && typeof detail === "object" && !Array.isArray(detail)
            ? Object.entries(detail)
                .map(([k, v]) => {
                  const val = Array.isArray(v) ? v.join(" ") : String(v ?? "");
                  return val ? `${k}: ${val}` : k;
                })
                .join("\n")
            : err instanceof Error
              ? err.message
              : "등록 요청 중 오류가 발생했습니다.";
      feedback.error(msg);
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
      const err = e as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const msg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : err?.response?.data?.detail
            ? String(err.response.data.detail)
            : err instanceof Error
              ? err.message
              : "등록 요청 중 오류가 발생했습니다.";
      feedback.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const handleClose = () => {
    setDeletedStudentConflict(null);
    onClose();
  };

  return (
    <>
    <AdminModal open={open} onClose={handleClose} type="action" width={MODAL_WIDTH.md} onEnterConfirm={!busy ? handleSubmit : undefined}>
      <ModalHeader
        type="action"
        title="학생 등록"
        description={mode === "choice" ? undefined : mode === "single" ? "학생 한 명을 수동으로 등록합니다" : "엑셀 파일로 학생을 일괄 등록합니다"}
      />

      {mode === "choice" ? (
        <ModalBody>
          <div className="modal-scroll-body grid gap-6 w-full max-w-full box-border">
            <div>
              <div className="modal-section-label mb-3">등록 방식</div>
              <div className="grid grid-cols-2 gap-5">
                <SessionBlockView
                  variant="n1"
                  compact={false}
                  selected={false}
                  showCheck={false}
                  title="1명만 등록"
                  desc="학생 한 명 수동 등록"
                  onClick={() => setMode("single")}
                  ariaLabel="1명만 등록"
                />
                <SessionBlockView
                  variant="supplement"
                  compact={false}
                  selected={false}
                  showCheck={false}
                  title="엑셀 업로드"
                  desc="엑셀 파일로 학생 일괄 등록"
                  onClick={() => setMode("excel")}
                  ariaLabel="엑셀 업로드"
                />
              </div>
            </div>
          </div>
        </ModalBody>
      ) : null}

      {mode !== "choice" ? (
        <>
          <ModalBody key={mode}>
            {deletedStudentConflict ? (
          <div className="modal-scroll-body modal-scroll-body--compact" style={{ padding: "var(--space-4)" }}>
            <div style={{ marginBottom: "var(--space-4)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
              삭제된 학생이 있습니다. 복원하시겠습니까?
            </div>
            <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", background: "var(--color-surface-secondary)", borderRadius: 8, fontSize: 14 }}>
              <div style={{ marginBottom: "var(--space-2)" }}>
                <strong>이름:</strong> {deletedStudentConflict.student.name || "-"}
              </div>
              <div style={{ marginBottom: "var(--space-2)" }}>
                <strong>PS 번호:</strong> {deletedStudentConflict.student.psNumber || "-"}
              </div>
              <div style={{ marginBottom: "var(--space-2)" }}>
                <strong>학부모 전화:</strong> {deletedStudentConflict.student.parentPhone || "-"}
              </div>
              {deletedStudentConflict.student.phone && (
                <div>
                  <strong>학생 전화:</strong> {deletedStudentConflict.student.phone}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <Button
                intent="primary"
                onClick={handleRestoreDeletedStudent}
                disabled={busy}
                style={{ width: "100%" }}
              >
                복원
              </Button>
              <Button
                onClick={handlePermanentDeleteAndReregister}
                disabled={busy}
                style={{ width: "100%" }}
              >
                즉시삭제 후 재등록
              </Button>
              <Button
                onClick={() => setDeletedStudentConflict(null)}
                disabled={busy}
                style={{ width: "100%" }}
              >
                취소
              </Button>
            </div>
          </div>
        ) : mode === "single" ? (
        <div id="student-create-modal-dropdown-root" className="modal-scroll-body modal-scroll-body--compact modal-scroll-body--no-scroll">
          <div
            className="modal-form-row"
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-3)",
              gap: "var(--space-3)",
            }}
          >
            <button
              type="button"
              onClick={() => setMode("choice")}
              className="modal-hint"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              ← 등록 방식 변경
            </button>
            <Dropdown
              open={messageDropdownOpen}
              onOpenChange={setMessageDropdownOpen}
              trigger={["click"]}
              getPopupContainer={() => document.getElementById("student-create-modal-dropdown-root") || document.body}
              popupRender={() => (
                <div
                  className="modal-form-group"
                  style={{ minWidth: 280, padding: "var(--space-4)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="modal-section-label">메시지 자동발송</span>
                  <div style={{ marginBottom: "var(--space-2)" }}>
                    <span className="modal-phone-label" style={{ marginBottom: "var(--space-1)", display: "block" }}>발송 유형</span>
                    <div className="modal-actions-inline" style={{ flexWrap: "wrap", gap: "var(--space-1)" }}>
                      <button
                        type="button"
                        className={`ds-choice-btn ds-choice-btn--primary${(localSignupMessageMode === "sms" || localSignupMessageMode === "both") ? " is-selected" : ""}`}
                        onClick={() => handleSetSignupMessageMode("sms")}
                        disabled={updateAutoSendMut.isPending}
                      >
                        메시지
                      </button>
                      <button
                        type="button"
                        className={`ds-choice-btn ds-choice-btn--primary${(localSignupMessageMode === "alimtalk" || localSignupMessageMode === "both") ? " is-selected" : ""}`}
                        onClick={() => handleSetSignupMessageMode("alimtalk")}
                        disabled={updateAutoSendMut.isPending}
                      >
                        알림톡
                      </button>
                    </div>
                    <span className="modal-hint" style={{ display: "block", marginTop: "var(--space-1)" }}>
                      메시지만 선택 시 문자만, 알림톡만 선택 시 알림톡만, 둘 다 선택 시 둘 다 발송
                    </span>
                  </div>
                  <div style={{ marginBottom: "var(--space-2)" }}>
                    <span className="modal-phone-label" style={{ marginBottom: "var(--space-1)" }}>발송할 템플릿</span>
                    <select
                      className="ds-input w-full"
                      value={localSignupTemplateId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        handleSelectSignupTemplateFromDropdown(v ? Number(v) : null);
                      }}
                      disabled={updateAutoSendMut.isPending}
                    >
                      <option value="">선택 안 함</option>
                      {messageTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.solapi_status === "APPROVED" ? " ✓" : t.solapi_status === "PENDING" ? " (검수대기)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    intent="secondary"
                    size="sm"
                    onClick={() => { setMessageDropdownOpen(false); setTemplateModalOpen(true); }}
                    disabled={createTemplateAndRegisterMut.isPending}
                    style={{ width: "100%" }}
                  >
                    + 추가하기 (템플릿 생성 후 가입 완료 메시지로 등록)
                  </Button>
                </div>
              )}
            >
              <button
                type="button"
                className="modal-hint"
                style={{
                  background: "none",
                  border: "1px solid var(--color-border-divider)",
                  cursor: "pointer",
                  padding: "var(--space-1) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                }}
              >
                메시지 자동발송 {signupConfig?.template_name ? `· ${signupConfig.template_name}` : ""} ▾
              </button>
            </Dropdown>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSendWelcomeMessage((v) => !v); }}
              disabled={busy}
              aria-pressed={sendWelcomeMessage}
              style={{
                padding: "var(--space-1) var(--space-3)",
                borderRadius: "var(--radius-md)",
                fontWeight: 700,
                fontSize: 13,
                border: "1px solid transparent",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
                background: sendWelcomeMessage ? "var(--color-status-success, #10b981)" : "var(--color-bg-surface-soft)",
                color: sendWelcomeMessage ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {sendWelcomeMessage ? "ON" : "OFF"}
            </button>
          </div>
          {/* 첫 블록: 이름(우측에 성별) · 로그인 아이디 · 초기 비밀번호 · 학부모 전화 */}
          <div className="modal-form-group">
            <div className="modal-form-row modal-form-row--1-auto" style={{ alignItems: "center", gap: "var(--space-3)" }}>
              <input
                name="name"
                placeholder="이름"
                value={form.name ?? ""}
                onChange={handleChange}
                className="ds-input"
                style={{ flex: 1 }}
                data-required="true"
                data-invalid={!String(form.name || "").trim() ? "true" : "false"}
                disabled={busy}
                autoFocus
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
            <input
              name="psNumber"
              placeholder="로그인 아이디 (PS 번호, 선택·미입력 시 자동 부여)"
              value={form.psNumber ?? ""}
              onChange={handleChange}
              className="ds-input"
              disabled={busy}
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
            <div className="modal-phone-row">
              <span className="modal-phone-label">학부모 전화번호 (필수)</span>
              <span className="modal-phone-desc">문자·연락 수신용입니다.</span>
              <PhoneInput010Blocks
                value={form.parentPhone ?? ""}
                onChange={(v) => setForm((p) => ({ ...p, parentPhone: v }))}
                disabled={busy}
                blockClassName="modal-phone-block"
                inputClassName="modal-phone-block-input"
                data-invalid={String(form.parentPhone ?? "").trim().length > 0 && String(form.parentPhone ?? "").trim().length !== 11}
                aria-label="학부모 전화"
              />
            </div>
          </div>

          {/* 선택 입력 블록 — 섹션 라벨 없음 */}
          <div className="modal-form-group modal-form-group--neutral">
            <div className="modal-phone-row">
              <span className="modal-phone-label">학생 전화번호 (선택)</span>
              <span className="modal-phone-desc">비우면 학부모 번호로 OMR 식별 등에 사용됩니다.</span>
              <PhoneInput010Blocks
                value={form.studentPhone ?? ""}
                onChange={(v) => setForm((p) => ({ ...p, studentPhone: v }))}
                disabled={busy}
                blockClassName="modal-phone-block"
                inputClassName="modal-phone-block-input"
                aria-label="학생 전화"
              />
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
            {form.schoolType === "HIGH" && (
              <input
                name="originMiddleSchool"
                placeholder="출신중학교 (선택)"
                value={form.originMiddleSchool ?? ""}
                onChange={handleChange}
                className="ds-input"
                disabled={busy}
              />
            )}
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
            <input
              name="address"
              placeholder="주소 (선택)"
              value={form.address ?? ""}
              onChange={handleChange}
              className="ds-input"
              disabled={busy}
            />
            <textarea
              name="memo"
              rows={1}
              placeholder="메모"
              value={form.memo ?? ""}
              onChange={handleChange}
              className="ds-textarea"
              disabled={busy}
              style={{ minHeight: 40, maxHeight: 40, resize: "none" }}
            />
          </div>

        </div>
        ) : (
        <div id="student-create-modal-dropdown-root" className="modal-scroll-body modal-scroll-body--compact modal-scroll-body--no-scroll" style={{ display: "flex", flexDirection: "column" }}>
          <div
            className="modal-form-row"
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-3)",
              gap: "var(--space-3)",
            }}
          >
            <button
              type="button"
              onClick={() => setMode("choice")}
              className="modal-hint"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              ← 등록 방식 변경
            </button>
            <Dropdown
              open={messageDropdownOpen}
              onOpenChange={setMessageDropdownOpen}
              trigger={["click"]}
              getPopupContainer={() => document.getElementById("student-create-modal-dropdown-root") || document.body}
              popupRender={() => (
                <div
                  className="modal-form-group"
                  style={{ minWidth: 280, padding: "var(--space-4)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="modal-section-label">메시지 자동발송</span>
                  <div style={{ marginBottom: "var(--space-2)" }}>
                    <span className="modal-phone-label" style={{ marginBottom: "var(--space-1)", display: "block" }}>발송 유형</span>
                    <div className="modal-actions-inline" style={{ flexWrap: "wrap", gap: "var(--space-1)" }}>
                      <button
                        type="button"
                        className={`ds-choice-btn ds-choice-btn--primary${(localSignupMessageMode === "sms" || localSignupMessageMode === "both") ? " is-selected" : ""}`}
                        onClick={() => handleSetSignupMessageMode("sms")}
                        disabled={updateAutoSendMut.isPending}
                      >
                        메시지
                      </button>
                      <button
                        type="button"
                        className={`ds-choice-btn ds-choice-btn--primary${(localSignupMessageMode === "alimtalk" || localSignupMessageMode === "both") ? " is-selected" : ""}`}
                        onClick={() => handleSetSignupMessageMode("alimtalk")}
                        disabled={updateAutoSendMut.isPending}
                      >
                        알림톡
                      </button>
                    </div>
                    <span className="modal-hint" style={{ display: "block", marginTop: "var(--space-1)" }}>
                      메시지만 선택 시 문자만, 알림톡만 선택 시 알림톡만, 둘 다 선택 시 둘 다 발송
                    </span>
                  </div>
                  <div style={{ marginBottom: "var(--space-2)" }}>
                    <span className="modal-phone-label" style={{ marginBottom: "var(--space-1)" }}>발송할 템플릿</span>
                    <select
                      className="ds-input w-full"
                      value={localSignupTemplateId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        handleSelectSignupTemplateFromDropdown(v ? Number(v) : null);
                      }}
                      disabled={updateAutoSendMut.isPending}
                    >
                      <option value="">선택 안 함</option>
                      {messageTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.solapi_status === "APPROVED" ? " ✓" : t.solapi_status === "PENDING" ? " (검수대기)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    intent="secondary"
                    size="sm"
                    onClick={() => { setMessageDropdownOpen(false); setTemplateModalOpen(true); }}
                    disabled={createTemplateAndRegisterMut.isPending}
                    style={{ width: "100%" }}
                  >
                    + 추가하기 (템플릿 생성 후 가입 완료 메시지로 등록)
                  </Button>
                </div>
              )}
            >
              <button
                type="button"
                className="modal-hint"
                style={{
                  background: "none",
                  border: "1px solid var(--color-border-divider)",
                  cursor: "pointer",
                  padding: "var(--space-1) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                }}
              >
                메시지 자동발송 {signupConfig?.template_name ? `· ${signupConfig.template_name}` : ""} ▾
              </button>
            </Dropdown>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSendWelcomeMessage((v) => !v); }}
              disabled={busy}
              aria-pressed={sendWelcomeMessage}
              style={{
                padding: "var(--space-1) var(--space-3)",
                borderRadius: "var(--radius-md)",
                fontWeight: 700,
                fontSize: 13,
                border: "1px solid transparent",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
                background: sendWelcomeMessage ? "var(--color-status-success, #10b981)" : "var(--color-bg-surface-soft)",
                color: sendWelcomeMessage ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {sendWelcomeMessage ? "ON" : "OFF"}
            </button>
          </div>
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

          <ExcelUploadZone
            onFileSelect={handleExcelFileSelect}
            selectedFile={selectedExcelFile}
            onClearFile={() => setSelectedExcelFile(null)}
            disabled={busy}
          />
        </div>
        )}
      </ModalBody>
      </>
      ) : null}

      <ModalFooter
        left={
          mode === "choice" ? null : mode === "excel" ? (
            <span className="modal-hint" style={{ marginBottom: 0 }}>
              {selectedExcelFile ? "초기 비밀번호 입력 후 등록" : "엑셀 파일 선택 후 등록"}
            </span>
          ) : null
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            {mode === "single" && (
              <Button intent="primary" onClick={handleSubmit} disabled={busy}>
                {busy ? "등록 중…" : "등록"}
              </Button>
            )}
            {mode === "excel" && selectedExcelFile && (
              <Button intent="primary" onClick={handleExcelRegister} disabled={busy}>
                {busy ? "등록 중…" : "등록"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>

    <TemplateEditModal
      open={templateModalOpen}
      onClose={() => setTemplateModalOpen(false)}
      category="default"
      initial={null}
      onSubmit={handleTemplateSubmit}
      isPending={createTemplateAndRegisterMut.isPending}
      zIndex={1100}
    />
    </>
  );
}
