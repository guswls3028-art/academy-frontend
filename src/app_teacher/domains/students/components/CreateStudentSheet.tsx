/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/students/components/CreateStudentSheet.tsx
// 학생 생성 바텀시트
// R-11: 기존 인라인 style baseline. 마이그레이션은 별도 백로그.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { createStudent } from "@/shared/api/contracts/students";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateStudentSheet({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("0000");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "">("");

  function normalizePhone(value: string): string {
    return value.replace(/\D/g, "").slice(0, 11);
  }

  function inferSchoolType(value: string): "HIGH" | "MIDDLE" | "ELEMENTARY" {
    const trimmed = value.trim();
    if (trimmed.endsWith("초")) return "ELEMENTARY";
    if (trimmed.endsWith("중")) return "MIDDLE";
    return "HIGH";
  }

  function validate(): string | null {
    const normalizedPhone = normalizePhone(phone);
    const normalizedParentPhone = normalizePhone(parentPhone);
    if (!name.trim()) return "이름을 입력해 주세요.";
    if (password.trim().length < 4) return "초기 비밀번호를 4자 이상 입력해 주세요.";
    if (!/^010\d{8}$/.test(normalizedParentPhone)) {
      return "학부모 전화번호를 010 뒤 8자리로 입력해 주세요.";
    }
    if (phone.trim() && !/^010\d{8}$/.test(normalizedPhone)) {
      return "학생 전화는 비우거나 010 뒤 8자리를 입력해 주세요.";
    }
    return null;
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const error = validate();
      if (error) throw new Error(error);
      const normalizedPhone = normalizePhone(phone);
      const normalizedParentPhone = normalizePhone(parentPhone);
      return createStudent({
        name: name.trim(),
        initialPassword: password.trim(),
        studentPhone: normalizedPhone,
        parentPhone: normalizedParentPhone,
        school: school.trim(),
        schoolType: inferSchoolType(school),
        grade: grade.trim(),
        gender: gender || undefined,
        active: true,
        sendWelcomeMessage: false,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-students"] });
      teacherToast.success(`${name} 학생이 등록되었습니다.`);
      resetAndClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "학생을 등록하지 못했습니다.")),
  });

  const resetAndClose = () => {
    setName(""); setPassword("0000"); setPhone(""); setParentPhone("");
    setSchool(""); setGrade(""); setGender("");
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={resetAndClose} title="학생 추가">
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Field label="이름 *" value={name} onChange={setName} placeholder="학생 이름" />
        <Field label="초기 비밀번호" value={password} onChange={setPassword} placeholder="0000" />
        <div className="flex gap-2">
          <Field label="학생 전화" value={phone} onChange={setPhone} placeholder="010-" type="tel" />
          <Field label="학부모 전화" value={parentPhone} onChange={setParentPhone} placeholder="010-" type="tel" />
        </div>
        <div className="flex gap-2">
          <Field label="학교" value={school} onChange={setSchool} placeholder="학교명" />
          <Field label="학년" value={grade} onChange={setGrade} placeholder="예: 1" />
        </div>

        {/* Gender */}
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>성별</label>
          <div className="flex gap-2">
            {([["M", "남"], ["F", "여"], ["", "미선택"]] as const).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setGender(val as any)}
                className="flex-1 text-[12px] font-semibold cursor-pointer"
                style={{
                  padding: "7px", borderRadius: "var(--tc-radius)",
                  border: gender === val ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
                  background: gender === val ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: gender === val ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                  textAlign: "center",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-2"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: name.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: name.trim() ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "등록 중..." : "등록"}
        </button>

      </div>
    </BottomSheet>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex-1">
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}
