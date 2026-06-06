// PATH: src/app_admin/domains/students/components/StudentCreateModal.tsx
// 학생 등록 모달 — 초기 선택(1명만 등록 / 엑셀 업로드) 후 해당 폼 표시

import { useEffect, useState } from "react";
import { Switch } from "antd";
import { FiMessageSquare } from "react-icons/fi";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import { createStudent, uploadStudentBulkFromExcel, bulkRestoreStudents, bulkPermanentDeleteStudents, mapStudent, type ClientStudent } from "../api/students.api";
import { downloadStudentExcelTemplate } from "../excel/studentExcel";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import { type SchoolType, useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import { feedback } from "@/shared/ui/feedback/feedback";
import styles from "./StudentCreateModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onBulkProgress?: (progress: { current: number; total: number } | null) => void;
}

type RegisterMode = "choice" | "single" | "excel";
type StudentCreateForm = {
  name: string;
  psNumber: string;
  gender: string;
  initialPassword: string;
  studentPhone: string;
  omrCode: string;
  parentPhone: string;
  schoolType: SchoolType;
  school: string;
  grade: string;
  schoolClass: string;
  major: string;
  originMiddleSchool: string;
  address: string;
  memo: string;
  active: boolean;
};

type EditableStudentCreateField = Exclude<keyof StudentCreateForm, "active">;

const SCHOOL_TYPES = new Set<SchoolType>(["ELEMENTARY", "MIDDLE", "HIGH"]);

function normalizeSchoolType(value: unknown, fallback: SchoolType): SchoolType {
  return typeof value === "string" && SCHOOL_TYPES.has(value as SchoolType)
    ? value as SchoolType
    : fallback;
}

function createInitialForm(defaultSchoolType: SchoolType): StudentCreateForm {
  return {
    name: "",
    psNumber: "",
    gender: "",
    initialPassword: "",
    studentPhone: "",
    omrCode: "",
    parentPhone: "",
    schoolType: defaultSchoolType,
    school: "",
    grade: "",
    schoolClass: "",
    major: "",
    originMiddleSchool: "",
    address: "",
    memo: "",
    active: true,
  };
}

/* ── 가입 안내 알림톡 토글 (단순 on/off) ── */

function WelcomeMessageToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={styles.welcomeToggle}
      data-checked={checked ? "true" : "false"}
    >
      <div
        className={styles.welcomeIcon}
        data-checked={checked ? "true" : "false"}
      >
        <FiMessageSquare size={15} aria-hidden />
      </div>
      <div className={styles.welcomeContent}>
        <span
          className={styles.welcomeTitle}
          data-checked={checked ? "true" : "false"}
        >
          가입 안내 알림톡 발송
        </span>
        <div className={styles.welcomeDescription}>
          {checked
            ? "학생·학부모에게 로그인 정보를 알림톡으로 보냅니다"
            : "켜면 학생·학부모에게 알림톡이 발송됩니다"}
        </div>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        size="small"
      />
    </div>
  );
}

/* ── 백엔드 필드명 → 사용자 친화 이름 ── */
const fieldLabel: Record<string, string> = {
  ps_number: "아이디",
  parent_phone: "학부모 연락처",
  phone: "학생 연락처",
  name: "이름",
  omr_code: "OMR 코드",
  school: "학교",
  grade: "학년",
  gender: "성별",
};

/* ── 메인 모달 ── */

export default function StudentCreateModal({ open, onClose, onSuccess, onBulkProgress }: Props) {
  const slm = useSchoolLevelMode();
  const [mode, setMode] = useState<RegisterMode>("choice");
  const [busy, setBusy] = useState(false);
  const [excelBulkPassword, setExcelBulkPassword] = useState("");
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [deletedStudentConflict, setDeletedStudentConflict] = useState<{ student: ClientStudent; formData: StudentCreateForm } | null>(null);

  const [sendWelcomeMessage, setSendWelcomeMessage] = useState(true);
  const [form, setForm] = useState<StudentCreateForm>(() =>
    createInitialForm(slm.defaultSchoolType)
  );

  useEffect(() => {
    if (!open) return;
    setMode("choice");
    setBusy(false);
    onBulkProgress?.(null);
    setExcelBulkPassword("");
    setSelectedExcelFile(null);
    setSendWelcomeMessage(true);
    setForm(createInitialForm(slm.defaultSchoolType));
  }, [open, onBulkProgress, slm.defaultSchoolType]);

  function handleExcelFileSelect(file: File) {
    setSelectedExcelFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((p) => {
      const field = name as EditableStudentCreateField;
      const next = { ...p, [field]: value };
      if (name === "school") {
        const t = String(value ?? "").trim();
        if (t.endsWith("고")) next.schoolType = "HIGH";
        else if (t.endsWith("중")) next.schoolType = "MIDDLE";
        else if (t.endsWith("초")) next.schoolType = "ELEMENTARY";
      }
      return next;
    });
  }

  function validate(): string | null {
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
      const parentPhone = String(form.parentPhone || "").trim();
      feedback.success(
        `등록 완료\n` +
        `학생 아이디: ${loginId}\n` +
        (parentPhone ? `학부모 아이디: ${parentPhone} (신규 계정은 전화번호 뒤 4자리)\n` : "") +
        `학생은 입력한 초기 비밀번호로 로그인하세요. 기존 학부모 계정은 비밀번호가 변경되지 않습니다.`
      );
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: Record<string, unknown>; status?: number }; message?: string };
      if (err?.response?.status === 409 && err.response.data?.code === "deleted_student_exists" && err.response.data?.deleted_student) {
        setDeletedStudentConflict({
          student: mapStudent(err.response.data.deleted_student),
          formData: { ...form },
        });
        setBusy(false);
        return;
      }
      if (err?.response?.status === 409 && err.response.data?.code === "duplicate_student") {
        feedback.error("이미 있는 학생입니다.");
        setBusy(false);
        return;
      }
      const data = err?.response?.data;
      let msg: string;
      if (data && typeof data === "object") {
        const detail = data.detail;
        if (typeof detail === "string") {
          msg = detail;
        } else {
          const parts = (Object.entries(data) as [string, unknown][])
            .filter(([k]) => k !== "code" && k !== "deleted_student")
            .map(([k, v]) => {
              const label = fieldLabel[k] ?? k;
              const val = Array.isArray(v) ? v.join(" ") : String(v ?? "");
              return val ? `${label}: ${val}` : label;
            });
          msg = parts.length ? parts.join("\n") : "입력값을 확인해 주세요.";
        }
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
      const result = await bulkRestoreStudents([deletedStudentConflict.student.id]);
      if (result.restored < 1) {
        const reason = result.skipped?.[0]?.reason;
        feedback.error(reason || "복원에 실패했습니다.");
        return;
      }
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
      const parentPhone = String(deletedStudentConflict.formData.parentPhone || "").trim();
      feedback.success(
        `등록 완료\n` +
        `학생 아이디: ${loginId}\n` +
        (parentPhone ? `학부모 아이디: ${parentPhone} (신규 계정은 전화번호 뒤 4자리)\n` : "") +
        `학생은 입력한 초기 비밀번호로 로그인하세요. 기존 학부모 계정은 비밀번호가 변경되지 않습니다.`
      );
      setDeletedStudentConflict(null);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: Record<string, unknown>; status?: number }; message?: string };
      const data = err?.response?.data;
      let msg: string;
      if (data && typeof data === "object") {
        const detail = data.detail;
        if (typeof detail === "string") {
          msg = detail;
        } else {
          const parts = (Object.entries(data) as [string, unknown][])
            .map(([k, v]) => {
              const label = fieldLabel[k] ?? k;
              const val = Array.isArray(v) ? v.join(" ") : String(v ?? "");
              return val ? `${label}: ${val}` : label;
            });
          msg = parts.length ? parts.join("\n") : "입력값을 확인해 주세요.";
        }
      } else {
        msg = err instanceof Error ? err.message : "등록 요청 중 오류가 발생했습니다.";
      }
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
      const { job_id } = await uploadStudentBulkFromExcel(
        selectedExcelFile,
        pwd,
        sendWelcomeMessage,
      );
      if (!job_id) {
        feedback.error("작업 ID를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      asyncStatusStore.addWorkerJob("학생 일괄 등록", job_id, "excel_parsing");
      feedback.success("백그라운드에서 진행됩니다. 우상단 작업박스에서 확인할 수 있습니다.");
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

  const enterConfirm = !busy
    ? mode === "single"
      ? handleSubmit
      : mode === "excel" && selectedExcelFile
        ? handleExcelRegister
        : undefined
    : undefined;

  return (
    <AdminModal open={open} onClose={handleClose} type="action" width={MODAL_WIDTH.md} onEnterConfirm={enterConfirm}>
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
          <div className={`modal-scroll-body modal-scroll-body--compact ${styles.conflictPanel}`}>
            <div className={styles.conflictTitle}>
              삭제 대기중인 학생입니다. 복구하시겠습니까?
            </div>
            <div className={styles.conflictCard}>
              <div className={styles.conflictField}>
                <strong>이름:</strong> {deletedStudentConflict.student.name || "-"}
              </div>
              <div className={styles.conflictField}>
                <strong>PS 번호:</strong> {deletedStudentConflict.student.psNumber || "-"}
              </div>
              <div className={styles.conflictField}>
                <strong>학부모 전화:</strong> {deletedStudentConflict.student.parentPhone || "-"}
              </div>
              {deletedStudentConflict.student.studentPhone && (
                <div>
                  <strong>학생 전화:</strong> {deletedStudentConflict.student.studentPhone}
                </div>
              )}
            </div>
            <div className={styles.conflictActions}>
              <Button
                intent="primary"
                onClick={handleRestoreDeletedStudent}
                disabled={busy}
                className={styles.fullWidth}
              >
                복원
              </Button>
              <Button
                onClick={handlePermanentDeleteAndReregister}
                disabled={busy}
                className={styles.fullWidth}
              >
                즉시삭제 후 재등록
              </Button>
              <Button
                onClick={() => setDeletedStudentConflict(null)}
                disabled={busy}
                className={styles.fullWidth}
              >
                취소
              </Button>
            </div>
          </div>
        ) : mode === "single" ? (
        <div className="modal-scroll-body modal-scroll-body--compact">
          {/* 알림톡 토글 */}
          <div className={styles.sectionSpacing}>
            <WelcomeMessageToggle checked={sendWelcomeMessage} onChange={setSendWelcomeMessage} disabled={busy} />
          </div>

          {/* 첫 블록: 이름(우측에 성별) · 로그인 아이디 · 초기 비밀번호 · 학부모 전화 */}
          <div className="modal-form-group">
            <div className={`modal-form-row modal-form-row--1-auto ${styles.nameRow}`}>
              <input
                name="name"
                placeholder="이름"
                value={form.name ?? ""}
                onChange={handleChange}
                className={`ds-input ${styles.nameInput}`}
                data-required="true"
                data-invalid={!String(form.name || "").trim() ? "true" : "false"}
                disabled={busy}
                autoFocus
              />
              <div className={`modal-actions-inline ${styles.genderActions}`}>
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

          {/* 선택 입력 블록 */}
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
                placeholder={slm.mode === "elementary_middle" ? "학교명 (XX초·XX중 입력 시 자동 선택)" : "학교명 (XX고·XX중 입력 시 자동 선택)"}
                value={form.school ?? ""}
                onChange={handleChange}
                className="ds-input"
                disabled={busy}
              />
              <select
                className={`ds-select ${styles.schoolSelect}`}
                value={form.schoolType || slm.defaultSchoolType}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    schoolType: normalizeSchoolType(e.target.value, p.schoolType),
                    grade: "",
                  }))
                }
                disabled={busy}
              >
                {slm.schoolTypes.map((st) => (
                  <option key={st} value={st}>{slm.getLabel(st)}</option>
                ))}
              </select>
              <select
                className={`ds-select ${styles.schoolSelect}`}
                value={form.grade}
                onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
                disabled={busy}
              >
                <option value="">학년</option>
                {slm.gradeRange(form.schoolType || slm.defaultSchoolType).map((g) => (
                  <option key={g} value={String(g)}>{g}학년</option>
                ))}
              </select>
            </div>
            {slm.showOriginMiddleSchool(form.schoolType) && (
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
              {slm.showTrack(form.schoolType) && (
                <input
                  name="major"
                  placeholder="계열"
                  value={form.major ?? ""}
                  onChange={handleChange}
                  className="ds-input"
                  disabled={busy}
                />
              )}
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
              className={`ds-textarea ${styles.memoTextarea}`}
              disabled={busy}
            />
          </div>

        </div>
        ) : (
        <div className={`modal-scroll-body modal-scroll-body--compact ${styles.excelStack}`}>
          {/* 상단: 등록방식 변경 */}
          <div className={styles.backModeWrapper}>
            <button
              type="button"
              onClick={() => setMode("choice")}
              className={`modal-hint ${styles.modeBackButton}`}
            >
              &larr; 등록 방식 변경
            </button>
          </div>

          {/* 알림톡 토글 */}
          <div className={styles.sectionSpacing}>
            <WelcomeMessageToggle checked={sendWelcomeMessage} onChange={setSendWelcomeMessage} disabled={busy} />
          </div>

          <div className={`modal-form-row modal-form-row--1-auto ${styles.excelPasswordRow}`}>
            <div>
              <label className="modal-section-label">초기 비밀번호 (일괄)</label>
              <input
                type="password"
                placeholder="모든 학생에 적용할 초기 비밀번호 (4자 이상)"
                value={excelBulkPassword ?? ""}
                onChange={(e) => setExcelBulkPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || busy || !selectedExcelFile) return;
                  e.preventDefault();
                  void handleExcelRegister();
                }}
                className={`ds-input ${styles.fullWidth}`}
                disabled={busy}
              />
            </div>
            <Button intent="secondary" onClick={() => downloadStudentExcelTemplate(slm.mode)} disabled={busy}>
              엑셀 양식 다운로드
            </Button>
          </div>

          <ExcelUploadZone
            onFileSelect={handleExcelFileSelect}
            selectedFile={selectedExcelFile}
            onClearFile={() => setSelectedExcelFile(null)}
            disabled={busy}
          />

          <div className={`modal-hint ${styles.excelHint}`}>
            학생 아이디는 자동 부여됩니다.<br />
            학부모 아이디는 학부모 전화번호이며, 신규 계정 초기 비밀번호는 전화번호 뒤 4자리입니다. 기존 학부모 계정은 비밀번호가 변경되지 않습니다.
          </div>
        </div>
        )}
      </ModalBody>
      </>
      ) : null}

      <ModalFooter
        left={
          mode === "choice" ? null : mode === "excel" ? (
            <span className={`modal-hint ${styles.footerHint}`}>
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
  );
}
