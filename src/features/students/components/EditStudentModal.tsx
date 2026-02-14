// PATH: src/features/students/components/EditStudentModal.tsx
import { useEffect, useMemo, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { STATUS_ACTIVE_COLOR, STATUS_INACTIVE_COLOR } from "@/shared/ui/domain";
import {
  formatPhoneForInput,
  formatIdentifierForInput,
  parsePhoneInput,
  parseIdentifierInput,
} from "@/shared/utils/phoneInput";
import { updateStudent } from "../api/students";

interface Props {
  open: boolean;
  initialValue: any;
  onClose: () => void;
  onSuccess: () => void;
}

function is8Digits(v: any) {
  return /^\d{8}$/.test(String(v ?? ""));
}

export default function EditStudentModal({
  open,
  initialValue,
  onClose,
  onSuccess,
}: Props) {
  const initialNoPhone = useMemo(() => {
    if (initialValue.usesIdentifier != null) return initialValue.usesIdentifier;
    return initialValue.studentPhone && is8Digits(initialValue.studentPhone);
  }, [initialValue.studentPhone, initialValue.usesIdentifier]);

  const [noPhone, setNoPhone] = useState(initialNoPhone);
  const [busy, setBusy] = useState(false);
  /** 400 응답 시 백엔드 필드별 에러 (backend key -> message). setFields 개념으로 매핑 */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: initialValue.name || "",
    gender: initialValue.gender || "",
    psNumber: initialValue.psNumber || "",
    studentPhone: initialNoPhone ? "" : initialValue.studentPhone || "",
    omrCode: initialNoPhone ? initialValue.studentPhone || "" : "",
    parentPhone: initialValue.parentPhone || "",
    schoolType: initialValue.schoolType || "HIGH",
    school: initialValue.school || "",
    grade: initialValue.grade ? String(initialValue.grade) : "",
    schoolClass: initialValue.schoolClass || "",
    major: initialValue.major || "",
    memo: initialValue.memo || "",
    active: !!initialValue.active,
  });

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSubmit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, form, noPhone, busy]);

  useEffect(() => {
    if (!open) return;
    setNoPhone(initialNoPhone);
    setBusy(false);
    setFieldErrors({});
    setForm({
      name: initialValue.name || "",
      gender: initialValue.gender || "",
      psNumber: initialValue.psNumber || "",
      studentPhone: initialNoPhone ? "" : initialValue.studentPhone || "",
      omrCode: initialNoPhone
        ? (() => {
            const p = String(initialValue.studentPhone || "").replace(/\D/g, "");
            return p.length === 11 && p.startsWith("010") ? p.slice(-8) : p.slice(0, 8);
          })()
        : "",
      parentPhone: initialValue.parentPhone || "",
      schoolType: initialValue.schoolType || "HIGH",
      school: initialValue.school || "",
      grade: initialValue.grade ? String(initialValue.grade) : "",
      schoolClass: initialValue.schoolClass || "",
      major: initialValue.major || "",
      memo: initialValue.memo || "",
      active: !!initialValue.active,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValue?.id]);

  /** 백엔드 필드명 -> 프론트 필드명 (setFields 매핑) */
  const backendToFrontendField: Record<string, string> = {
    ps_number: "psNumber",
    omr_code: noPhone ? "omrCode" : "studentPhone",
    phone: "studentPhone",
    parent_phone: "parentPhone",
    name: "name",
  };

  function handleChange(e: any) {
    const { name } = e.target;
    setForm((p) => ({ ...p, [name]: e.target.value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function handlePhoneChange(name: "studentPhone" | "parentPhone", value: string) {
    const raw = parsePhoneInput(value);
    setForm((p) => ({ ...p, [name]: raw }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function handleIdentifierChange(value: string) {
    const raw = parseIdentifierInput(value);
    setForm((p) => ({ ...p, omrCode: raw }));
    if (fieldErrors.omrCode) setFieldErrors((prev) => ({ ...prev, omrCode: "" }));
  }

  /** StudentUpdateSerializer / 모델 기준 필수: name, ps_number, phone, parent_phone (Create와 동일) */
  function validate(): string | null {
    if (!String(form.name || "").trim()) return "필수 입력입니다.";
    if (!String(form.psNumber || "").trim()) return "필수 입력입니다.";

    if (noPhone) {
      const code = String(form.omrCode || "").trim();
      if (!code) return "필수 입력입니다.";
      if (!/^\d{8}$/.test(code)) return "식별자는 8자리 숫자(XXXXXXXX)여야 합니다.";
    } else {
      const phone = String(form.studentPhone || "").trim();
      if (!phone) return "필수 입력입니다.";
      if (!/^010\d{8}$/.test(phone)) return "학생 전화번호는 010XXXXXXXX 형식이어야 합니다.";
    }

    const parent = String(form.parentPhone || "").trim();
    if (!parent) return "필수 입력입니다.";
    if (!/^010\d{8}$/.test(parent)) return "학부모 전화번호는 010XXXXXXXX 형식이어야 합니다.";

    return null;
  }

  async function handleSubmit() {
    if (busy) return;

    const err = validate();
    if (err) return alert(err);

    setBusy(true);
    setFieldErrors({});
    try {
      await updateStudent(initialValue.id, { ...form, noPhone });
      onSuccess();
      onClose();
    } catch (raw: any) {
      const data = raw?.response?.data;
      if (raw?.response?.status === 400 && data && typeof data === "object") {
        const next: Record<string, string> = {};
        for (const [backendKey, val] of Object.entries(data)) {
          const msg = Array.isArray(val) ? val[0] : typeof val === "string" ? val : "";
          if (!msg) continue;
          const frontKey = backendToFrontendField[backendKey] ?? backendKey;
          next[frontKey] = msg;
        }
        setFieldErrors(next);
        const messages = Object.entries(next)
          .map(([k, v]) => (k === "name" ? "이름" : k === "psNumber" ? "아이디" : k === "studentPhone" ? "학생 전화/식별자" : k === "omrCode" ? "식별자" : k === "parentPhone" ? "학부모 전화" : k) + ": " + v)
          .join("\n");
        alert(messages);
      } else {
        alert(raw?.message || "저장에 실패했습니다.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader
        type="action"
        title="학생 수정"
        description="⌘/Ctrl + Enter 로 저장"
      />

      <ModalBody>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            <input
              name="name"
              placeholder="이름"
              value={form.name}
              onChange={handleChange}
              className="ds-input"
              data-required="true"
              data-invalid={!String(form.name || "").trim() ? "true" : "false"}
              disabled={busy}
              autoFocus
            />

            <div style={{ display: "flex", gap: 8 }}>
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
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              name="psNumber"
              placeholder="아이디(PS 번호)"
              value={form.psNumber}
              onChange={handleChange}
              className="ds-input"
              data-required="true"
              data-invalid={!String(form.psNumber || "").trim() ? "true" : "false"}
              disabled={busy}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 12px",
                borderRadius: 12,
                border: "1px solid var(--color-border-divider)",
                background: "var(--color-bg-surface-soft)",
                height: 44,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "var(--color-text-secondary)",
                }}
              >
                상태
              </span>
              <button
                type="button"
                aria-pressed={form.active}
                onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
                disabled={busy}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  color: "#fff",
                  backgroundColor: form.active ? STATUS_ACTIVE_COLOR : STATUS_INACTIVE_COLOR,
                  border: "none",
                }}
              >
                {form.active ? "활성" : "비활성"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            {noPhone ? (
              <input
                placeholder="식별자 (XXXX-XXXX)"
                value={formatIdentifierForInput(form.omrCode)}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                className="ds-input"
                data-required="true"
                disabled={busy}
                maxLength={9}
                inputMode="numeric"
                pattern="[0-9\-]*"
              />
            ) : (
              <input
                placeholder="학생 전화번호 (010-XXXX-XXXX)"
                value={formatPhoneForInput(form.studentPhone)}
                onChange={(e) => handlePhoneChange("studentPhone", e.target.value)}
                className="ds-input"
                data-required="true"
                disabled={busy}
                maxLength={13}
                inputMode="numeric"
                pattern="[0-9\-]*"
              />
            )}
            <Button
              intent={noPhone ? "secondary" : "ghost"}
              onClick={() => {
                setNoPhone((v) => !v);
                setForm((p) => ({ ...p, studentPhone: "", omrCode: "" }));
              }}
              disabled={busy}
            >
              {noPhone ? "전화번호 입력" : "없음(식별자사용)"}
            </Button>
          </div>

          <input
            placeholder="학부모 전화번호 (010-XXXX-XXXX)"
            value={formatPhoneForInput(form.parentPhone)}
            onChange={(e) => handlePhoneChange("parentPhone", e.target.value)}
            className="ds-input"
            data-required="true"
            disabled={busy}
            maxLength={13}
            inputMode="numeric"
            pattern="[0-9\-]*"
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            <input
              name="school"
              placeholder="학교명"
              value={form.school}
              onChange={handleChange}
              className="ds-input"
              disabled={busy}
            />
            <div style={{ display: "flex", gap: 8 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              name="schoolClass"
              placeholder="반"
              value={form.schoolClass}
              onChange={handleChange}
              className="ds-input"
              disabled={busy}
            />
            <input
              name="major"
              placeholder="계열(고등만)"
              value={form.major}
              onChange={handleChange}
              className="ds-input"
              disabled={busy}
            />
          </div>

          <textarea
            name="memo"
            rows={4}
            placeholder="메모"
            value={form.memo}
            onChange={handleChange}
            className="ds-textarea"
            disabled={busy}
          />
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
            ⌘/Ctrl + Enter 저장
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button intent="primary" onClick={handleSubmit} disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
