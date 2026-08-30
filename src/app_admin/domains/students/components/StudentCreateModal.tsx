// PATH: src/app_admin/domains/students/components/StudentCreateModal.tsx
// 학생 등록 모달 — 초기 선택(1명만 등록 / 엑셀 업로드) 후 해당 폼 표시

import { useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiInfo, FiMessageSquare, FiSmartphone, FiUsers } from "react-icons/fi";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import ExcelUploadZone from "@/shared/ui/excel/ExcelUploadZone";
import {
  createStudent,
  uploadStudentBulkFromExcel,
  bulkRestoreStudents,
  bulkPermanentDeleteStudents,
  mapStudent,
  type ClientStudent,
  type ClientStudentCustomFieldDefinition,
  type StudentCustomFieldValues,
} from "../api/students.api";
import {
  downloadStudentExcelTemplate,
  parseStudentExcel,
  type ParseStudentExcelResult,
} from "../excel/studentExcel";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import { type SchoolType, useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import { formatPhone } from "@/shared/utils/formatPhone";
import InitialPasswordMethodSelector from "@/shared/product/students/InitialPasswordMethodSelector";
import StudentCustomFieldsForm from "./StudentCustomFieldsForm";
import { plannedStudentLoginId, presentStudentLoginReadback } from "./studentLoginReadback";
import {
  DEFAULT_STUDENT_INITIAL_PASSWORD_SETTINGS,
  isStudentInitialPasswordReady,
  type StudentInitialPasswordSettings,
} from "@/shared/product/students/initialPassword";
import styles from "./StudentCreateModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onBulkProgress?: (progress: { current: number; total: number } | null) => void;
  customFieldDefinitions?: ClientStudentCustomFieldDefinition[];
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
  customFields: StudentCustomFieldValues;
};

type EditableStudentCreateField = Exclude<keyof StudentCreateForm, "active" | "customFields">;

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
    customFields: {},
  };
}

/* ── 첫 수강 계정 안내 알림톡 고정 안내 ── */

function WelcomeMessageNotice() {
  return (
    <div
      className={styles.welcomeToggle}
      data-checked="true"
    >
      <div
        className={styles.welcomeIcon}
        data-checked="true"
      >
        <FiMessageSquare size={15} aria-hidden />
      </div>
      <div className={styles.welcomeContent}>
        <span
          className={styles.welcomeTitle}
          data-checked="true"
        >
          첫 수강 확정 시 계정 안내 발송
        </span>
        <div className={styles.welcomeDescription}>
          학생 명부 등록만으로는 발송되지 않으며, 실제 강의의 수강생으로 처음 확정될 때 학생·학부모에게 알림톡이 발송됩니다.
        </div>
      </div>
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

export default function StudentCreateModal({
  open,
  onClose,
  onSuccess,
  onBulkProgress,
  customFieldDefinitions = [],
}: Props) {
  const slm = useSchoolLevelMode();
  const confirm = useConfirm();
  const confirmationInFlightRef = useRef(false);
  const [mode, setMode] = useState<RegisterMode>("choice");
  const [busy, setBusy] = useState(false);
  const [excelPasswordSettings, setExcelPasswordSettings] = useState<StudentInitialPasswordSettings>(
    () => ({ ...DEFAULT_STUDENT_INITIAL_PASSWORD_SETTINGS }),
  );
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [parsedExcel, setParsedExcel] = useState<ParseStudentExcelResult | null>(null);
  const [deletedStudentConflict, setDeletedStudentConflict] = useState<{ student: ClientStudent; formData: StudentCreateForm } | null>(null);
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState<StudentCreateForm>(() =>
    createInitialForm(slm.defaultSchoolType)
  );

  useEffect(() => {
    if (!open) return;
    setMode("choice");
    setBusy(false);
    confirmationInFlightRef.current = false;
    onBulkProgress?.(null);
    setExcelPasswordSettings({ ...DEFAULT_STUDENT_INITIAL_PASSWORD_SETTINGS });
    setSelectedExcelFile(null);
    setParsedExcel(null);
    setSubmitError("");
    setForm(createInitialForm(slm.defaultSchoolType));
  }, [open, onBulkProgress, slm.defaultSchoolType]);

  async function handleExcelFileSelect(file: File) {
    if (busy) return;
    setBusy(true);
    try {
      const parsed = await parseStudentExcel(file);
      if (!parsed.rows.length) {
        feedback.error("등록할 학생 데이터가 없습니다.");
        return;
      }
      setSelectedExcelFile(file);
      setParsedExcel(parsed);
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : "엑셀 파일을 읽지 못했습니다.");
    } finally {
      setBusy(false);
    }
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
    if (busy || confirmationInFlightRef.current) return;

    const err = validate();
    if (err) {
      setSubmitError(err);
      feedback.error(err);
      return;
    }
    setSubmitError("");

    const schoolSummary = [
      String(form.school || "").trim(),
      form.grade ? `${form.grade}학년` : "",
    ].filter(Boolean).join(" · ") || "미입력";
    confirmationInFlightRef.current = true;
    const confirmed = await confirm({
      title: "학생 등록 최종 확인",
      message: "계정과 연락처 정보가 맞는지 확인해 주세요. 비밀번호 값은 화면에 다시 표시하지 않습니다.",
      review: {
        eyebrow: "학생 명부 등록 검토",
        items: [
          { label: "학생", value: String(form.name || "").trim(), tone: "accent" },
          { label: "로그인 ID", value: plannedStudentLoginId(form.psNumber, form.studentPhone) || "자동 부여" },
          { label: "학부모 연락처", value: formatPhone(String(form.parentPhone || "").trim()) },
          { label: "학생 연락처", value: String(form.studentPhone || "").trim() ? formatPhone(String(form.studentPhone).trim()) : "미입력" },
          { label: "학교·학년", value: schoolSummary },
          { label: "초기 비밀번호", value: "입력 완료" },
        ],
        note: "지금은 학생 명부와 계정만 준비합니다. 강의 수강과 계정 안내 알림톡은 아직 발생하지 않습니다.",
      },
      confirmText: "확인하고 등록",
      cancelText: "다시 확인",
    });
    confirmationInFlightRef.current = false;
    if (!confirmed || busy) return;

    setBusy(true);
    try {
      const student = await createStudent({
        ...form,
        noPhone: !String(form.studentPhone || "").trim() || String(form.studentPhone || "").trim().length < 11,
      });
      const expectedLoginId = plannedStudentLoginId(form.psNumber, form.studentPhone);
      const loginId = String(student?.psNumber || "").trim();
      const parentPhone = String(form.parentPhone || "").trim();
      const readbackError = await presentStudentLoginReadback({
        confirm,
        studentId: student.id,
        expectedLoginId,
        loginId,
        parentPhone,
      });
      if (readbackError) setSubmitError(readbackError);
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
        const message = "이미 있는 학생입니다.";
        setSubmitError(message);
        feedback.error(message);
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
      setSubmitError(msg);
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
    if (!deletedStudentConflict || busy || confirmationInFlightRef.current) return;
    confirmationInFlightRef.current = true;
    const confirmed = await confirm({
      title: "학생 영구삭제 후 재등록 확인",
      message: "삭제 대기 중인 기존 기록을 영구삭제한 뒤 현재 입력값으로 새 학생을 등록합니다.",
      review: {
        eyebrow: "복구할 수 없는 작업 검토",
        items: [
          { label: "기존 학생", value: deletedStudentConflict.student.name || "이름 없음", tone: "warning" },
          { label: "기존 ID", value: deletedStudentConflict.student.psNumber || "자동 부여 ID" },
          { label: "학부모 연락처", value: formatPhone(deletedStudentConflict.student.parentPhone || "") || "미입력" },
          { label: "새 학생", value: deletedStudentConflict.formData.name.trim(), tone: "accent" },
        ],
        note: "기존 학생은 복구할 수 없습니다. 영구삭제 뒤 새 학생 등록이 실패하면 기존 기록만 삭제된 상태가 될 수 있습니다. 가능하면 먼저 ‘복원’을 사용하세요.",
      },
      confirmText: "영구삭제 후 재등록",
      cancelText: "취소",
      danger: true,
    });
    confirmationInFlightRef.current = false;
    if (!confirmed || busy) return;
    setBusy(true);
    try {
      await bulkPermanentDeleteStudents([deletedStudentConflict.student.id]);
      const student = await createStudent({
        ...deletedStudentConflict.formData,
        noPhone: !String(deletedStudentConflict.formData.studentPhone || "").trim(),
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
    if (busy || confirmationInFlightRef.current || !selectedExcelFile || !parsedExcel) return;
    const invalidStudentPhoneNames = parsedExcel.rows
      .filter((row) => row.usesIdentifier || !/^010\d{8}$/.test(row.studentPhone))
      .map((row) => row.name || "(이름 없음)");
    if (
      excelPasswordSettings.mode === "phone_last4"
      && invalidStudentPhoneNames.length >= parsedExcel.rows.length
    ) {
      feedback.error(
        "현재 방식으로 등록할 학생이 없습니다. 공통 비밀번호 또는 학생별 랜덤 비밀번호를 선택해 주세요.",
      );
      return;
    }
    if (!isStudentInitialPasswordReady(excelPasswordSettings, invalidStudentPhoneNames.length, true)) {
      feedback.error(
        excelPasswordSettings.mode === "fixed"
          ? "공통 초기 비밀번호를 4자 이상 입력해 주세요."
          : "초기 비밀번호 방식을 확인해 주세요.",
      );
      return;
    }
    const excludedCount = excelPasswordSettings.mode === "phone_last4"
      ? invalidStudentPhoneNames.length
      : 0;
    const eligibleCount = Math.max(0, parsedExcel.rows.length - excludedCount);
    const passwordModeLabel = excelPasswordSettings.mode === "phone_last4"
      ? "학생 휴대폰 뒤 4자리"
      : excelPasswordSettings.mode === "fixed"
        ? "공통 비밀번호"
        : "학생별 랜덤 비밀번호";
    confirmationInFlightRef.current = true;
    const confirmed = await confirm({
      title: "학생 일괄 등록 최종 확인",
      message: "파일과 등록 인원을 확인해 주세요. 확인 후 작업박스에서 처리 결과를 볼 수 있습니다.",
      review: {
        eyebrow: "학생 명부 일괄 등록 검토",
        items: [
          { label: "파일", value: selectedExcelFile.name },
          { label: "전체 행", value: `${parsedExcel.rows.length}명` },
          { label: "등록 요청", value: `${eligibleCount}명`, tone: "accent" },
          ...(excludedCount > 0
            ? [{ label: "제외", value: `${excludedCount}명 · 학생 휴대폰 확인 필요`, tone: "warning" as const }]
            : []),
          { label: "초기 비밀번호", value: passwordModeLabel },
        ],
        note: "학생 명부 등록 요청이며 강의 수강은 만들지 않습니다. 계정 안내 알림톡은 첫 수강 확정 때 별도로 발송됩니다.",
      },
      confirmText: `${eligibleCount}명 등록 요청`,
      cancelText: "다시 확인",
    });
    confirmationInFlightRef.current = false;
    if (!confirmed || busy) return;

    setBusy(true);
    try {
      const { job_id } = await uploadStudentBulkFromExcel(
        selectedExcelFile,
        excelPasswordSettings,
      );
      if (!job_id) {
        feedback.error("작업 ID를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      asyncStatusStore.addWorkerJob(
        "학생 일괄 등록",
        job_id,
        "excel_parsing",
        undefined,
        { expectsCredentialDownload: excelPasswordSettings.mode === "random" },
      );
      feedback.success(
        "등록 요청을 받았습니다. 작업박스에서 신규·기존·확인 필요 인원을 확인해 주세요.",
      );
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

  const enterConfirm =
    busy || deletedStudentConflict
      ? undefined
      : mode === "single"
        ? handleSubmit
        : mode === "excel" && selectedExcelFile
          ? handleExcelRegister
          : undefined;
  const invalidExcelStudentPhoneNames = parsedExcel?.rows
    .filter((row) => row.usesIdentifier || !/^010\d{8}$/.test(row.studentPhone))
    .map((row) => row.name || "(이름 없음)") ?? [];
  const excelPasswordReady = isStudentInitialPasswordReady(
    excelPasswordSettings,
    invalidExcelStudentPhoneNames.length,
    true,
  );
  const excelRowCount = parsedExcel?.rows.length ?? 0;
  const excelStudentPhoneCount = Math.max(
    0,
    excelRowCount - invalidExcelStudentPhoneNames.length,
  );
  const excelExcludedRowCount = excelPasswordSettings.mode === "phone_last4"
    ? invalidExcelStudentPhoneNames.length
    : 0;
  const excelEligibleRowCount = Math.max(0, excelRowCount - excelExcludedRowCount);

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
          {/* 알림톡 발송 안내 */}
          <div className={styles.sectionSpacing}>
            <WelcomeMessageNotice />
          </div>

          {submitError && (
            <div className={styles.submitError} role="alert" aria-live="assertive">
              <strong>등록 결과를 확인해 주세요.</strong>
              <span>{submitError}</span>
            </div>
          )}

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
              placeholder="로그인 아이디 (선택·비우면 학생 전화번호 사용)"
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
              <span className="modal-phone-desc">알림톡·연락 수신용입니다.</span>
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
              <span className="modal-phone-desc">입력하면 학생 로그인 ID로 사용합니다. 비우면 ID를 자동 부여합니다.</span>
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

          <StudentCustomFieldsForm
            definitions={customFieldDefinitions}
            values={form.customFields}
            onChange={(key, value) => setForm((previous) => ({
              ...previous,
              customFields: { ...previous.customFields, [key]: value },
            }))}
            disabled={busy}
          />

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

          {/* 알림톡 발송 안내 */}
          <div className={styles.sectionSpacing}>
            <WelcomeMessageNotice />
          </div>

          <section className={styles.excelSection} aria-labelledby="student-excel-file-heading">
            <div className={styles.excelSectionHeader}>
              <div>
                <span className={styles.stepLabel}>1</span>
                <span id="student-excel-file-heading" className={styles.excelSectionTitle}>
                  학생 명단 선택
                </span>
              </div>
              <span className={styles.excelSectionDescription}>이름·학부모 전화번호 필수</span>
            </div>
            <Button
              intent="secondary"
              onClick={() => {
                void downloadStudentExcelTemplate(slm.mode, customFieldDefinitions)
                  .catch(() => feedback.error("엑셀 양식 다운로드에 실패했습니다."));
              }}
              disabled={busy}
            >
              엑셀 양식 다운로드
            </Button>
            <ExcelUploadZone
              onFileSelect={handleExcelFileSelect}
              selectedFile={selectedExcelFile}
              onClearFile={() => {
                setSelectedExcelFile(null);
                setParsedExcel(null);
              }}
              disabled={busy}
              hintText="안전한 .xlsx 파일 · 최대 10MB"
            />

            {parsedExcel ? (
              <div
                className={styles.fileReview}
                role="region"
                aria-label="엑셀 파일 확인 결과"
                aria-live="polite"
              >
                <div className={styles.fileReviewHeading}>
                  <FiCheckCircle aria-hidden />
                  <strong>파일을 읽었습니다</strong>
                  <span>등록 전에 아래 인원을 확인해 주세요.</span>
                </div>
                <div className={styles.fileMetrics}>
                  <div className={styles.fileMetric}>
                    <FiUsers aria-hidden />
                    <span>읽은 학생</span>
                    <strong>{excelRowCount}명</strong>
                  </div>
                  <div className={styles.fileMetric}>
                    <FiSmartphone aria-hidden />
                    <span>학생 전화번호 있음</span>
                    <strong>{excelStudentPhoneCount}명</strong>
                  </div>
                  <div
                    className={styles.fileMetric}
                    data-tone={invalidExcelStudentPhoneNames.length > 0 ? "notice" : "neutral"}
                  >
                    <FiInfo aria-hidden />
                    <span>없음·식별번호 사용</span>
                    <strong>{invalidExcelStudentPhoneNames.length}명</strong>
                  </div>
                </div>
                {invalidExcelStudentPhoneNames.length > 0 ? (
                  <div
                    className={styles.phoneCoverageNotice}
                    data-tone={excelExcludedRowCount > 0 ? "warning" : "ready"}
                  >
                    {excelExcludedRowCount > 0
                      ? `${excelExcludedRowCount}명은 현재 비밀번호 방식에서 제외됩니다. 모두 등록하려면 공통 비밀번호 또는 학생별 랜덤 비밀번호를 선택하세요.`
                      : `${invalidExcelStudentPhoneNames.length}명도 자동 아이디를 받아 함께 등록됩니다.`}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className={styles.excelSection} aria-labelledby="student-excel-password-heading">
            <div className={styles.excelSectionHeader}>
              <div>
                <span className={styles.stepLabel}>2</span>
                <span id="student-excel-password-heading" className={styles.excelSectionTitle}>
                  신규 학생 비밀번호
                </span>
              </div>
              <span className={styles.excelSectionDescription}>기존 계정의 비밀번호는 바뀌지 않음</span>
            </div>
            <InitialPasswordMethodSelector
              value={excelPasswordSettings}
              onChange={setExcelPasswordSettings}
              disabled={busy}
              invalidStudentPhoneNames={invalidExcelStudentPhoneNames}
              allowPartialRows
            />
          </section>

          <aside className={styles.identityGuide} aria-label="기존 학생 확인 규칙">
            <div className={styles.identityGuideTitle}>
              <FiInfo aria-hidden />
              기존 학생을 이렇게 확인합니다
            </div>
            <ul>
              <li>학생 전화번호가 있으면 같은 번호의 기존 학생을 먼저 찾습니다.</li>
              <li>번호가 없거나 다르면 <strong>이름 전체 + 학부모 전화번호</strong>로 확인합니다.</li>
              <li><strong>김지우a·김지우1·괄호 표기도 이름 그대로</strong>이며, 형제·자매는 학부모 번호가 같아도 됩니다.</li>
            </ul>
          </aside>
        </div>
        )}
      </ModalBody>
      </>
      ) : null}

      <ModalFooter
        left={
          mode === "choice" ? null : mode === "excel" ? (
            <span className={`modal-hint ${styles.footerHint}`}>
              {parsedExcel
                ? excelExcludedRowCount > 0
                  ? `${excelRowCount}명 확인 · 등록 ${excelEligibleRowCount}명 · 제외 ${excelExcludedRowCount}명`
                  : `${excelRowCount}명 확인 · 전원 등록 요청 가능`
                : "엑셀 파일을 선택하면 등록 인원을 먼저 확인합니다"}
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
              <Button
                intent="primary"
                onClick={handleExcelRegister}
                disabled={busy || !excelPasswordReady || excelEligibleRowCount === 0}
              >
                {busy ? "요청 중…" : `${excelEligibleRowCount}명 등록 요청`}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
