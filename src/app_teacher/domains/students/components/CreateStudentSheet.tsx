/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/students/components/CreateStudentSheet.tsx
// 학생 생성 바텀시트
// R-11: 기존 인라인 style baseline. 마이그레이션은 별도 백로그.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { MessageSquare } from "@teacher/shared/ui/Icons";
import { ICON } from "@/shared/ui/ds";
import { createStudent } from "@/shared/api/contracts/students";
import type { ClientStudent } from "@/shared/api/contracts/students";
import { openStudentSupportPreview } from "@/shared/studentSupport/studentSupport.api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { teacherStudentsQueryKeys } from "../queryKeys";

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
  const [submitError, setSubmitError] = useState("");
  const [createdStudent, setCreatedStudent] = useState<ClientStudent | null>(null);

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
      });
    },
    onSuccess: (student) => {
      qc.invalidateQueries({ queryKey: teacherStudentsQueryKeys.teacherStudents });
      const expectedLoginId = normalizePhone(phone);
      const actualLoginId = String(student.psNumber || "").trim();
      if (expectedLoginId && actualLoginId !== expectedLoginId) {
        setSubmitError("예상 로그인 ID와 실제 저장 ID가 다릅니다. 학생 화면을 확인한 뒤 아이디를 안내해 주세요.");
        teacherToast.error("학생은 등록됐지만 로그인 ID 확인이 필요합니다.");
      } else {
        setSubmitError("");
        teacherToast.success(`${name} 학생 등록과 로그인 ID 확인이 완료되었습니다.`);
      }
      setCreatedStudent(student);
    },
    onError: (e) => {
      const message = extractApiError(e, "학생을 등록하지 못했습니다.");
      setSubmitError(message);
      teacherToast.error(message);
    },
  });

  const resetAndClose = () => {
    setName(""); setPassword("0000"); setPhone(""); setParentPhone("");
    setSchool(""); setGrade(""); setGender("");
    setSubmitError(""); setCreatedStudent(null);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={resetAndClose} title="학생 추가">
      {createdStudent ? (
        <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-4) 0" }}>
          <div
            role={submitError ? "alert" : "status"}
            style={{
              padding: 14,
              borderRadius: "var(--tc-radius)",
              border: `1px solid ${submitError ? "var(--tc-danger)" : "var(--tc-success)"}`,
              background: submitError ? "var(--tc-danger-bg)" : "var(--tc-success-bg)",
            }}
          >
            <div className="text-sm font-bold" style={{ color: "var(--tc-text)" }}>
              {submitError ? "등록 완료 · 계정 확인 필요" : "등록 완료 · 계정 준비됨"}
            </div>
            <div className="text-[12px] mt-1" style={{ color: "var(--tc-text-secondary)" }}>
              로그인 ID: <strong>{createdStudent.psNumber || "확인되지 않음"}</strong>
            </div>
            {submitError && (
              <div className="text-[12px] mt-2" style={{ color: "var(--tc-danger)" }}>{submitError}</div>
            )}
          </div>
          <button
            type="button"
            className="w-full text-sm font-bold cursor-pointer"
            style={{ padding: 12, borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}
            onClick={() => {
              void openStudentSupportPreview(createdStudent.id).catch((error) => {
                const message = error instanceof Error ? error.message : "학생 화면을 열지 못했습니다.";
                setSubmitError(message);
                teacherToast.error(message);
              });
            }}
          >
            학생 화면 바로 검수
          </button>
          <button
            type="button"
            className="w-full text-sm font-semibold cursor-pointer"
            style={{ padding: 11, borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text)" }}
            onClick={resetAndClose}
          >
            확인하고 닫기
          </button>
        </div>
      ) : (
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Field label="이름 *" value={name} onChange={setName} placeholder="학생 이름" />
        <Field label="초기 비밀번호" value={password} onChange={setPassword} placeholder="0000" />
        <div className="flex gap-2">
          <Field label="학생 전화 (로그인 ID)" value={phone} onChange={setPhone} placeholder="010-" type="tel" />
          <Field label="학부모 전화" value={parentPhone} onChange={setParentPhone} placeholder="010-" type="tel" />
        </div>
        <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
          학생 전화를 입력하면 그 번호를 로그인 ID로 사용합니다. 비우면 ID가 자동 부여됩니다.
        </div>

        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            className="text-[12px] font-semibold"
            style={{ padding: "10px 12px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-danger)", background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}
          >
            {submitError}
          </div>
        )}
        <div
          className="flex items-center gap-2"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--tc-radius-sm)",
            border: "1px solid var(--tc-border-subtle)",
            background: "var(--tc-primary-bg)",
          }}>
          <MessageSquare size={ICON.xs} style={{ color: "var(--tc-primary)" }} />
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--tc-text)" }}>첫 수강 확정 시 계정 안내 발송</div>
            <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
              학생 명부 등록만으로는 발송되지 않으며, 실제 강의의 수강생으로 처음 확정될 때 학생·학부모에게 알림톡이 발송됩니다.
            </div>
          </div>
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

        <div
          className="sticky bottom-0"
          style={{ padding: "8px 0 4px", background: "var(--tc-surface)" }}>
          <button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}
            className="w-full text-sm font-bold cursor-pointer"
            style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: name.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: name.trim() ? "#fff" : "var(--tc-text-muted)" }}>
            {mutation.isPending ? "등록 중..." : "등록"}
          </button>
        </div>

      </div>
      )}
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
