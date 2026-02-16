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

  async function handleExcelFileSelect(file: File) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await parseStudentExcel(file);
      if (!result.rows?.length) {
        alert("등록할 학생 데이터가 없습니다.");
        return;
      }
      setExcelParsedRows(result.rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "엑셀 파일을 읽는 중 오류가 발생했습니다.";
      alert(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleExcelRegister() {
    if (busy || !excelParsedRows?.length) return;
    const pwd = String(excelBulkPassword || "").trim();
    if (!pwd || pwd.length < 4) {
      alert("초기 비밀번호를 4자 이상 입력해 주세요.");
      return;
    }
    const students = excelParsedRows.map((r) => ({
      name: r.name.trim(),
      phone: r.studentPhone,
      parentPhone: r.parentPhone,
      usesIdentifier: !!r.usesIdentifier,
      gender: r.gender || null,
      schoolType: r.schoolType,
      school: r.school || null,
      grade: r.grade ? Number(r.grade) || null : null,
      schoolClass: r.schoolClass || null,
      major: r.schoolType === "HIGH" ? (r.major || null) : null,
      memo: r.memo || null,
    }));
    setBusy(true);
    const initProg = { current: 0, total: students.length };
    setProgress(initProg);
    onBulkProgress?.(initProg);

    const CHUNK_SIZE = 20; // 한 번에 20명씩 처리
    let totalCreated = 0;
    const allFailed: BulkFailedItem[] = [];
    
    try {
      // 청크 단위로 나눠서 요청
      for (let i = 0; i < students.length; i += CHUNK_SIZE) {
        const chunk = students.slice(i, i + CHUNK_SIZE);
        const prog = { current: i, total: students.length };
        setProgress(prog);
        onBulkProgress?.(prog);
        
        try {
          const result = await bulkCreateStudents(pwd, chunk, sendWelcomeMessage);
          totalCreated += result.created ?? 0;
          
          // 실패 항목의 row 번호를 전체 인덱스로 조정
          const failedWithStudent: BulkFailedItem[] = (result.failed ?? []).map((f: { row: number; name: string; error: string; conflict_student_id?: number }) => ({
            ...f,
            row: i + f.row, // 전체 인덱스로 조정
            conflict_student_id: f.conflict_student_id ?? null,
            student: chunk[f.row - 1] ?? { name: f.name, phone: "", parentPhone: "" },
          }));
          allFailed.push(...failedWithStudent);
        } catch (chunkError: unknown) {
          // 청크 단위 에러(400 등) 시 백엔드 메시지 추출
          let errMsg = "등록 중 오류가 발생했습니다.";
          if (chunkError && typeof chunkError === "object" && "response" in chunkError) {
            const res = (chunkError as { response?: { data?: unknown; status?: number } }).response;
            const data = res?.data;
            if (data && typeof data === "object") {
              const d = data as Record<string, unknown>;
              if (typeof d.detail === "string") errMsg = d.detail;
              else if (d.detail && typeof d.detail === "object") {
                const parts = Object.entries(d.detail as Record<string, unknown>).flatMap(([k, v]) =>
                  Array.isArray(v) ? v.map((x) => `${k}: ${x}`) : [`${k}: ${v}`]
                );
                if (parts.length) errMsg = parts.join(" · ");
              } else if (d.students && Array.isArray(d.students)) {
                const first = (d.students as unknown[])[0];
                if (first && typeof first === "object") {
                  const msgs = Object.entries(first as Record<string, unknown>).flatMap(([k, v]) =>
                    Array.isArray(v) ? v.map((x) => `${k}: ${x}`) : []
                  );
                  if (msgs.length) errMsg = msgs.join(" · ");
                }
              }
            }
          } else if (chunkError instanceof Error) {
            errMsg = chunkError.message;
          }
          chunk.forEach((s, idx) => {
            allFailed.push({
              row: i + idx + 1,
              name: s.name,
              error: errMsg,
              conflict_student_id: null,
              student: s,
            });
          });
        }
      }
      
      const doneProg = { current: students.length, total: students.length };
      setProgress(doneProg);
      onBulkProgress?.(doneProg);
      setBulkResult({
        created: totalCreated,
        failed: allFailed,
        total: students.length,
        password: pwd,
      });
      setConflictResolutions({});
      setBatchConflictAction(null);
      setExcelParsedRows(null);
      if (totalCreated > 0) onSuccess();
      // 실패 항목이 없으면 모달 자동 닫기
      if (allFailed.length === 0) {
        setTimeout(() => {
          setProgress(null);
          onBulkProgress?.(null);
          onClose();
        }, 500);
      } else {
        setProgress(null);
        onBulkProgress?.(null);
      }
    } catch (e: unknown) {
      let msg = "등록 중 오류가 발생했습니다.";
      if (e && typeof e === "object" && "response" in e) {
        const data = (e as { response?: { data?: unknown } }).response?.data;
        if (data && typeof data === "object") {
          const d = data as Record<string, unknown>;
          if (typeof d.detail === "string") msg = d.detail;
          else if (d.detail && typeof d.detail === "object") {
            const parts = Object.entries(d.detail as Record<string, unknown>).map(
              ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
            );
            if (parts.length) msg = parts.join("\n");
          }
        }
      } else if (e instanceof Error) msg = e.message;
      alert(msg);
      setProgress(null);
      onBulkProgress?.(null);
    } finally {
      setBusy(false);
    }
  }

  function updateFailedItem(index: number, field: "phone", value: string) {
    if (!bulkResult) return;
    const next = [...bulkResult.failed];
    next[index] = { ...next[index], student: { ...next[index].student, [field]: value } };
    setBulkResult({ ...bulkResult, failed: next });
  }

  function setConflictResolution(row: number, action: "restore" | "delete") {
    setConflictResolutions((p) => ({ ...p, [row]: action }));
  }

  function applyBatchConflictResolution() {
    if (!batchConflictAction || !bulkResult) return;
    const next: Record<number, "restore" | "delete"> = {};
    for (const item of bulkResult.failed) {
      if (item.conflict_student_id) next[item.row] = batchConflictAction;
    }
    setConflictResolutions(next);
  }

  const conflictedItems = (bulkResult?.failed ?? []).filter((f) => f.conflict_student_id);
  const hasUnresolvedConflicts = conflictedItems.some((f) => !conflictResolutions[f.row]);

  async function handleResolveConflicts() {
    if (!bulkResult || !conflictedItems.length || busy || hasUnresolvedConflicts) return;
    const resolutions = conflictedItems
      .filter((f) => conflictResolutions[f.row])
      .map((f) => ({
        row: f.row,
        student_id: f.conflict_student_id!,
        action: conflictResolutions[f.row] as "restore" | "delete",
        student_data: {
          name: f.student.name,
          phone: String(f.student.phone || "").replace(/\D/g, ""),
          parent_phone: String(f.student.parentPhone || "").replace(/\D/g, ""),
          uses_identifier: false,
          gender: f.student.gender || "",
          school_type: f.student.schoolType || "HIGH",
          school: f.student.school || "",
          high_school_class: f.student.schoolClass || "",
          major: f.student.major || "",
          grade: f.student.grade ?? null,
          memo: f.student.memo || "",
        },
      }));
    if (!resolutions.length) return;
    setBusy(true);
    try {
      const result = await bulkResolveConflicts(bulkResult.password, resolutions, sendWelcomeMessage);
      const stillFailed = (result.failed ?? []).map((f) => {
        const orig = bulkResult.failed.find((x) => x.row === f.row);
        return {
          ...f,
          conflict_student_id: orig?.conflict_student_id,
          student: orig?.student ?? { name: f.name, phone: "", parentPhone: "" },
        };
      });
      const newCreated = (bulkResult.created ?? 0) + (result.created ?? 0) + (result.restored ?? 0);
      setBulkResult({
        created: newCreated,
        failed: stillFailed,
        total: bulkResult.total,
        password: bulkResult.password,
      });
      setConflictResolutions({});
      setBatchConflictAction(null);
      if (result.created > 0 || result.restored) onSuccess();
      if (stillFailed.length === 0) onClose();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "충돌 해결 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryFailed() {
    if (!bulkResult || !bulkResult.failed.length || busy) return;
    setBusy(true);
    try {
      const toSend = bulkResult.failed.map((f) => {
        let phone = f.student.phone.replace(/\D/g, "");
        if (phone.length === 8 && /^\d{8}$/.test(phone)) phone = `010${phone}`;
        return {
          name: f.student.name,
          phone,
          parentPhone: f.student.parentPhone.replace(/\D/g, ""),
          gender: f.student.gender,
          schoolType: f.student.schoolType,
          school: f.student.school,
          grade: f.student.grade,
          schoolClass: f.student.schoolClass,
          major: f.student.major,
          memo: f.student.memo,
        };
      });
      const result = await bulkCreateStudents(bulkResult.password, toSend, sendWelcomeMessage);
      const stillFailed: BulkFailedItem[] = (result.failed ?? []).map((f) => {
        const idx = f.row - 1;
        const orig = bulkResult.failed[idx];
        return {
          row: f.row,
          name: f.name,
          error: f.error,
          student: orig?.student ?? { name: f.name, phone: "", parentPhone: "" },
        };
      });
      setBulkResult({
        created: bulkResult.created + result.created,
        failed: stillFailed,
        total: bulkResult.total,
        password: bulkResult.password,
      });
      if (result.created > 0) onSuccess();
      if (stillFailed.length === 0) onClose();
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
        {progress && activeTab === "excel" && (
          <div className="modal-form-group" style={{ marginTop: "var(--space-3)", padding: "var(--space-3) var(--space-4)" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-brand-primary)" }}>창을 닫아도 진행됩니다</span>
          </div>
        )}
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
        ) : bulkResult ? (
        <div className="modal-scroll-body modal-scroll-body--compact" style={{ display: "flex", flexDirection: "column" }}>
          <div className="modal-section-label" style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
            {bulkResult.created}명 등록 완료
            {bulkResult.failed.length > 0 && ` · 실패 ${bulkResult.failed.length}건`}
          </div>

          {bulkResult.failed.length > 0 && (
            <>
              <div className="modal-form-group modal-form-group--row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <span className="modal-hint" style={{ lineHeight: 1.5 }}>
                  필수: 이름, 학부모 전화. 학생 전화는 선택(없으면 학부모 전화 8자리로 OMR). 아이디 6자리 자동 부여.
                  {conflictedItems.length > 0 && (
                    <span className="modal-hint--block">
                      <strong>삭제된 학생과 번호 충돌</strong> 시 복원 또는 삭제 후 재등록을 선택하세요.
                    </span>
                  )}
                </span>
              </div>

              {conflictedItems.length > 0 && (
                <div className="modal-actions-inline" style={{ gap: "var(--space-3)" }}>
                  <span className="modal-section-label" style={{ marginBottom: 0 }}>일괄 적용:</span>
                  <Button
                    intent={batchConflictAction === "restore" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setBatchConflictAction("restore")}
                  >
                    모두 복원
                  </Button>
                  <Button
                    intent={batchConflictAction === "delete" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setBatchConflictAction("delete")}
                  >
                    모두 삭제 후 재등록
                  </Button>
                  <Button intent="secondary" size="sm" onClick={applyBatchConflictResolution}>
                    적용
                  </Button>
                </div>
              )}

              <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {bulkResult.failed.map((item, idx) => (
                  <div key={idx} className="modal-form-group modal-form-group--compact">
                    <div className="modal-section-label" style={{ marginBottom: "var(--space-1)", fontSize: 12 }}>
                      {item.row}행 {item.name} · <span style={{ color: "var(--color-status-error)" }}>{item.error}</span>
                    </div>
                    {item.conflict_student_id && (
                      <div className="modal-actions-inline" style={{ marginBottom: "var(--space-2)" }}>
                        <label className="modal-section-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", marginBottom: 0, cursor: "pointer", fontSize: 13 }}>
                          <input
                            type="radio"
                            name={`conflict-${item.row}`}
                            checked={conflictResolutions[item.row] === "restore"}
                            onChange={() => setConflictResolution(item.row, "restore")}
                          />
                          복원
                        </label>
                        <label className="modal-section-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", marginBottom: 0, cursor: "pointer", fontSize: 13 }}>
                          <input
                            type="radio"
                            name={`conflict-${item.row}`}
                            checked={conflictResolutions[item.row] === "delete"}
                            onChange={() => setConflictResolution(item.row, "delete")}
                          />
                          삭제 후 재등록
                        </label>
                      </div>
                    )}
                    <div className="modal-form-row modal-form-row--1-auto">
                      <input
                        placeholder="학생 전화(선택) · 없으면 학부모 전화로 OMR"
                        value={
                          (() => {
                            const raw = String(item.student?.phone ?? "").replace(/\D/g, "");
                            if (raw.length === 8) return formatIdentifierForInput(raw);
                            if (raw.length === 11) return formatPhoneForInput(raw);
                            return item.student?.phone ?? "";
                          })()
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                          const phone = raw.length === 8 ? `010${raw}` : raw;
                          updateFailedItem(idx, "phone", phone);
                        }}
                        className="ds-input"
                        maxLength={13}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions-inline">
                {conflictedItems.length > 0 && (
                  <Button
                    intent="primary"
                    onClick={handleResolveConflicts}
                    disabled={busy || hasUnresolvedConflicts}
                  >
                    {busy ? "처리 중…" : "충돌 해결 후 등록"}
                  </Button>
                )}
                <Button intent="primary" onClick={handleRetryFailed} disabled={busy}>
                  {busy ? "다시 등록 중…" : "실패 항목 다시 등록"}
                </Button>
              </div>
            </>
          )}

          <Button intent="secondary" onClick={() => { setBulkResult(null); onClose(); }}>
            완료
          </Button>
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

          {excelParsedRows && excelParsedRows.length > 0 && (
            <div className="modal-form-group modal-form-group--row" style={{ justifyContent: "space-between" }}>
              <span className="modal-section-label" style={{ marginBottom: 0 }}>
                {excelParsedRows.length}명 등록 예정
              </span>
              <Button
                intent="ghost"
                size="sm"
                onClick={() => setExcelParsedRows(null)}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {progress && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 200, height: 6, background: "var(--color-bg-surface-soft)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                      height: "100%",
                      background: "var(--color-primary)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", minWidth: 60 }}>
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>
                  ({progress.current}/{progress.total}명)
                </span>
              </div>
            )}
            <span className="modal-hint" style={{ marginBottom: 0 }}>
              {activeTab === "single"
                ? "⌘/Ctrl + Enter 등록"
                : bulkResult
                ? "실패 항목 수정 후 '다시 등록'"
                : excelParsedRows?.length
                ? "초기 비밀번호 입력 후 등록"
                : "엑셀 파일 선택 후 등록"}
            </span>
          </div>
        }
        right={
          <>
            {progress && activeTab === "excel" ? (
              <Button intent="secondary" onClick={onClose}>
                닫기
              </Button>
            ) : (
              <Button intent="secondary" onClick={onClose} disabled={busy}>
                취소
              </Button>
            )}
            {activeTab === "single" && (
              <Button intent="primary" onClick={handleSubmit} disabled={busy}>
                {busy ? "등록 중…" : "등록"}
              </Button>
            )}
            {activeTab === "excel" && !bulkResult && excelParsedRows && excelParsedRows.length > 0 && (
              <Button intent="primary" onClick={handleExcelRegister} disabled={busy}>
                {busy ? (progress ? `등록 중… ${Math.round((progress.current / progress.total) * 100)}%` : "등록 중…") : "등록"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
