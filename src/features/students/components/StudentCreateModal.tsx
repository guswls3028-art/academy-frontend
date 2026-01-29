// PATH: src/features/students/components/StudentCreateModal.tsx

import { useState } from "react";
import { createStudent } from "../api/students";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function StudentCreateModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: "",
    studentPhone: "",
    initialPassword: "",

    parentPhone: "",
    schoolType: "HIGH",
    school: "",
    schoolClass: "",
    major: "",

    grade: "",
    gender: "",
    memo: "",
    active: true,
  });

  function handleChange(e: any) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit() {
    // ✅ 최소 수정: 백엔드 validate_phone / initial_password 조건 충족 (빈값 방지)
    if (!form.studentPhone || !String(form.studentPhone).trim()) {
      alert("학생 전화번호는 필수입니다.");
      return;
    }

    if (!form.initialPassword || String(form.initialPassword).trim().length < 4) {
      alert("초기 비밀번호는 4자 이상 필수입니다.");
      return;
    }

    try {
      await createStudent({
        ...form,
        // ✅ 빈 문자열이 서버로 넘어가면 DRF validation에서 걸릴 수 있어서 trim만 적용(필수 필드만)
        studentPhone: String(form.studentPhone).trim(),
        initialPassword: String(form.initialPassword).trim(),
      });

      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[420px] rounded-xl bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-divider)] overflow-hidden">
        {/* Header */}
        <div className="border-b border-[var(--border-divider)] px-5 py-4 bg-[var(--bg-surface-soft)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            학생 등록
          </h2>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            기본 정보 입력 후 생성
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-2 max-h-[70vh] overflow-y-auto">
          <input
            name="name"
            placeholder="이름"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
          />

          <input
            name="studentPhone"
            placeholder="학생 전화번호 (ID)"
            value={form.studentPhone}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
          />

          <input
            name="initialPassword"
            type="password"
            placeholder="초기 비밀번호"
            value={form.initialPassword}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
          />
          <div className="text-xs text-[var(--text-muted)]">
            * 초기 비밀번호 (학생이 로그인 후 변경 가능)
          </div>

          <input
            name="parentPhone"
            placeholder="학부모 전화번호"
            value={form.parentPhone}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
          />

          {/* School Type */}
          <div className="flex gap-4 text-sm text-[var(--text-primary)]">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="schoolType"
                value="HIGH"
                checked={form.schoolType === "HIGH"}
                onChange={handleChange}
              />
              고등
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="schoolType"
                value="MIDDLE"
                checked={form.schoolType === "MIDDLE"}
                onChange={handleChange}
              />
              중등
            </label>
          </div>

          <input
            name="school"
            placeholder={form.schoolType === "HIGH" ? "고등학교 이름" : "중학교 이름"}
            value={form.school}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
          />

          {form.schoolType === "HIGH" && (
            <>
              <input
                name="schoolClass"
                placeholder="반"
                value={form.schoolClass}
                onChange={handleChange}
                className="w-full rounded-md px-3 py-2 text-sm
                  border border-[var(--border-divider)]
                  bg-[var(--bg-app)]
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-muted)]
                  focus:outline-none
                  focus:ring-1
                  focus:ring-[var(--color-primary)]"
              />

              <input
                name="major"
                placeholder="계열"
                value={form.major}
                onChange={handleChange}
                className="w-full rounded-md px-3 py-2 text-sm
                  border border-[var(--border-divider)]
                  bg-[var(--bg-app)]
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-muted)]
                  focus:outline-none
                  focus:ring-1
                  focus:ring-[var(--color-primary)]"
              />
            </>
          )}

          <select
            name="grade"
            value={form.grade}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
          >
            <option value="">학년 선택</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>

          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
          >
            <option value="">성별 선택</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>

          <textarea
            name="memo"
            placeholder="메모"
            rows={3}
            value={form.memo}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm resize-none
              border border-[var(--border-divider)]
              bg-[var(--bg-app)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none
              focus:ring-1
              focus:ring-[var(--color-primary)]"
          />

          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              name="active"
              checked={form.active}
              onChange={handleChange}
            />
            활성 여부
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-divider)] bg-[var(--bg-surface)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md
              border border-[var(--border-divider)]
              text-[var(--text-secondary)]
              hover:bg-[var(--bg-surface-soft)]"
          >
            취소
          </button>

          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 text-sm rounded-md
              bg-[var(--color-primary)]
              text-white
              hover:opacity-90"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
