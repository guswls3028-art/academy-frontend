// PATH: src/features/students/components/StudentCreateModal.tsx
import { useEffect, useRef, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button, Tabs } from "@/shared/ui/ds";
import { STATUS_ACTIVE_COLOR, STATUS_INACTIVE_COLOR } from "@/shared/ui/domain";
import {
  formatPhoneForInput,
  formatIdentifierForInput,
  parsePhoneInput,
} from "@/shared/utils/phoneInput";
import { createStudent, bulkCreateStudents, bulkResolveConflicts } from "../api/students";
import {
  downloadStudentExcelTemplate,
  parseStudentExcel,
  type ParsedStudentRow,
} from "../excel/studentExcel";

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

interface BulkFailedItem {
  row: number;
  name: string;
  error: string;
  conflict_student_id?: number | null;
  student: {
    name: string;
    phone: string;
    parentPhone: string;
    gender?: string | null;
    schoolType?: "HIGH" | "MIDDLE";
    school?: string | null;
    grade?: number | null;
    schoolClass?: string | null;
    major?: string | null;
    memo?: string | null;
  };
}

interface BulkResult {
  created: number;
  failed: BulkFailedItem[];
  total: number;
  password: string;
}

export default function StudentCreateModal({ open, onClose, onSuccess, onBulkProgress }: Props) {
  const [activeTab, setActiveTab] = useState("single");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [excelBulkPassword, setExcelBulkPassword] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [excelParsedRows, setExcelParsedRows] = useState<ParsedStudentRow[] | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<number, "restore" | "delete">>({});
  const [batchConflictAction, setBatchConflictAction] = useState<"restore" | "delete" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setProgress(null);
    onBulkProgress?.(null);
    setExcelBulkPassword("");
    setBulkResult(null);
    setExcelParsedRows(null);
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
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
      const rows = await parseStudentExcel(file);
      if (!rows.length) {
        alert("등록할 학생 데이터가 없습니다.");
        return;
      }
      setExcelParsedRows(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "엑셀 파일을 읽는 중 오류가 발생했습니다.";
      alert(msg);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.wide}>
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
        <div className="modal-scroll-body">
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
              placeholder="학부모 전화번호 (010-XXXX-XXXX)"
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

          <input
            placeholder="학생 전화번호 (선택, 없으면 부모 전화로 OMR 식별)"
            value={formatPhoneForInput(form.studentPhone ?? "")}
            onChange={(e) => handlePhoneChange("studentPhone", e.target.value)}
            className="ds-input"
            disabled={busy}
            maxLength={13}
            inputMode="numeric"
            pattern="[0-9\-]*"
          />

          <div className="modal-option-row" style={{ display: "flex", gap: "var(--space-2)", padding: "var(--space-3)", flexWrap: "wrap" }}>
            {[{ key: "M", label: "남자" }, { key: "F", label: "여자" }].map((g) => (
              <Button
                key={g.key}
                intent={form.gender === g.key ? "secondary" : "ghost"}
                aria-pressed={form.gender === g.key}
                onClick={() => setForm((p) => ({ ...p, gender: g.key }))}
                disabled={busy}
              >
                {g.label}
              </Button>
            ))}
          </div>

          <div className="modal-option-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", padding: "var(--space-3)" }}>
            {[{ key: "HIGH", label: "고등학교" }, { key: "MIDDLE", label: "중학교" }].map(
              (t) => (
                <Button
                  key={t.key}
                  intent={form.schoolType === t.key ? "secondary" : "ghost"}
                  aria-pressed={form.schoolType === t.key}
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      schoolType: t.key,
                      school: "",
                      schoolClass: "",
                      major: "",
                    }))
                  }
                  disabled={busy}
                >
                  {t.label}
                </Button>
              )
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-2)" }}>
            <input
              name="school"
              placeholder="학교명"
              value={form.school ?? ""}
              onChange={handleChange}
              className="ds-input"
              disabled={busy}
            />
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              {["1", "2", "3"].map((g) => (
                <Button
                  key={g}
                  intent={form.grade === g ? "secondary" : "ghost"}
                  aria-pressed={form.grade === g}
                  onClick={() => setForm((p) => ({ ...p, grade: g }))}
                  disabled={busy}
                >
                  {g}학년
                </Button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
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
            rows={4}
            placeholder="메모"
            value={form.memo ?? ""}
            onChange={handleChange}
            className="ds-textarea"
            disabled={busy}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-2)", alignItems: "center" }}>
            <span className="modal-section-label" style={{ marginBottom: 0, fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)" }}>
              등록 후 상세 화면에서 태그/메모/상태를 추가로 관리할 수 있습니다.
            </span>
            <button
              type="button"
              aria-pressed={form.active}
              onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
              disabled={busy}
              style={{
                padding: "var(--space-2) var(--space-3)",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: "var(--radius-md)",
                color: "#fff",
                backgroundColor: form.active ? STATUS_ACTIVE_COLOR : STATUS_INACTIVE_COLOR,
                border: "none",
              }}
            >
              {form.active ? "활성" : "비활성"}
            </button>
          </div>
        </div>
        ) : bulkResult ? (
        <div className="modal-scroll-body" style={{ display: "flex", flexDirection: "column" }}>
          <div className="modal-section-label" style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
            {bulkResult.created}명 등록 완료
            {bulkResult.failed.length > 0 && ` · 실패 ${bulkResult.failed.length}건`}
          </div>

          {bulkResult.failed.length > 0 && (
            <>
              <div className="modal-form-group" style={{ padding: "var(--space-3) var(--space-4)" }}>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                필수: 이름, 학부모 전화. 학생 전화는 선택(없으면 학부모 전화 8자리로 OMR 식별). 아이디 6자리 자동 부여.
                {conflictedItems.length > 0 && (
                  <span style={{ display: "block", marginTop: "var(--space-2)" }}>
                    <strong>삭제된 학생과 번호 충돌</strong> 시 복원 또는 삭제 후 재등록을 선택하세요.
                  </span>
                )}
                </span>
              </div>

              {conflictedItems.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
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
                  <div key={idx} className="modal-form-group" style={{ padding: "var(--space-3)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      {item.row}행 {item.name} · <span style={{ color: "var(--color-status-error)" }}>{item.error}</span>
                    </div>
                    {item.conflict_student_id && (
                      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                          <input
                            type="radio"
                            name={`conflict-${item.row}`}
                            checked={conflictResolutions[item.row] === "restore"}
                            onChange={() => setConflictResolution(item.row, "restore")}
                          />
                          복원
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
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
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        placeholder="학생 전화(010-XXXX-XXXX, 선택) · 없으면 학부모 전화로 OMR"
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
                        style={{ flex: 1, minWidth: 180 }}
                        maxLength={13}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        <div className="modal-scroll-body" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-2)", alignItems: "end" }}>
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

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className="modal-form-group"
            style={{
              border: "2px dashed var(--color-border-divider)",
              padding: "var(--space-8)",
              textAlign: "center",
              cursor: "pointer",
              background: "var(--color-bg-surface-soft)",
              color: "var(--color-text-secondary)",
            }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-primary)"; }}
            onDragLeave={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border-divider)"; }}
            onDrop={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border-divider)";
              const file = e.dataTransfer.files[0];
              if (file && /\.(xlsx|xls)$/i.test(file.name)) {
                handleExcelFileSelect(file);
              } else {
                alert("엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.");
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleExcelFileSelect(file);
              }}
            />
            <div className="modal-section-label" style={{ fontSize: 15, marginBottom: "var(--space-2)" }}>
              엑셀 파일을 드래그하거나 클릭하여 업로드
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              .xlsx, .xls · 필수: 이름, 학부모 전화. 학생 전화는 선택(없으면 학부모 전화 8자리로 OMR). 아이디 6자리 자동 부여.
            </div>
          </div>

          {excelParsedRows && excelParsedRows.length > 0 && (
            <div className="modal-form-group" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
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
            <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
              {activeTab === "single"
                ? "⌘/Ctrl + Enter 등록"
                : bulkResult
                ? "실패 항목을 수정한 뒤 '다시 등록'을 누르세요"
                : excelParsedRows?.length
                ? "초기 비밀번호 입력 후 '등록' 버튼을 눌러 주세요"
                : "엑셀 파일을 선택한 뒤 '등록' 버튼을 눌러 주세요"}
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
