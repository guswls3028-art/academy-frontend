// PATH: src/features/students/components/EditStudentModal.tsx
import { useEffect, useMemo, useState } from "react";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
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
    return initialValue.studentPhone && is8Digits(initialValue.studentPhone);
  }, [initialValue.studentPhone]);

  const [noPhone, setNoPhone] = useState(initialNoPhone);
  const [busy, setBusy] = useState(false);

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
    setForm({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValue?.id]);

  function handleChange(e: any) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  function validate(): string | null {
    if (!String(form.name || "").trim()) return "이름은 필수입니다.";
    if (!String(form.psNumber || "").trim()) return "PS 번호는 필수입니다.";

    if (noPhone) {
      const code = String(form.omrCode || "").trim();
      if (!/^\d{8}$/.test(code)) return "식별자는 8자리 숫자(XXXXXXXX)여야 합니다.";
    } else {
      const phone = String(form.studentPhone || "").trim();
      if (!phone) return "학생 전화번호를 입력하세요.";
      if (!/^010\d{8}$/.test(phone)) return "학생 전화번호는 010XXXXXXXX 형식이어야 합니다.";
    }

    const parent = String(form.parentPhone || "").trim();
    if (!parent) return "학부모 전화번호는 필수입니다.";
    if (!/^010\d{8}$/.test(parent)) return "학부모 전화번호는 010XXXXXXXX 형식이어야 합니다.";

    return null;
  }

  async function handleSubmit() {
    if (busy) return;

    const err = validate();
    if (err) return alert(err);

    setBusy(true);
    try {
      await updateStudent(initialValue.id, { ...form, noPhone });
      onSuccess();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={720}>
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
              <Button
                intent={form.active ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={form.active}
                onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
                disabled={busy}
              >
                {form.active ? "활성" : "비활성"}
              </Button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            <input
              name={noPhone ? "omrCode" : "studentPhone"}
              placeholder={noPhone ? "식별자 (XXXXXXXX)" : "학생 전화번호 (010XXXXXXXX)"}
              value={noPhone ? form.omrCode : form.studentPhone}
              onChange={handleChange}
              className="ds-input"
              data-required="true"
              disabled={busy}
            />
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
            name="parentPhone"
            placeholder="학부모 전화번호 (010XXXXXXXX)"
            value={form.parentPhone}
            onChange={handleChange}
            className="ds-input"
            data-required="true"
            disabled={busy}
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
