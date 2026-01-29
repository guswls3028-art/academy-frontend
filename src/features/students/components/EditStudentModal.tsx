// PATH: src/features/students/components/EditStudentModal.tsx

import { useState } from "react";
import { createStudent, updateStudent } from "../api/students";

export default function StudentFormModal({
  initialValue,
  onClose,
  onSuccess,
}: {
  initialValue?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!initialValue;

  const [form, setForm] = useState(
    initialValue || {
      name: "",
      parentPhone: "",
      studentPhone: "",
      school: "",
      schoolClass: "",
      grade: "",
      gender: "",
      memo: "",
      active: true,
    }
  );

  function handleChange(e: any) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit() {
    try {
      if (isEdit) await updateStudent(initialValue.id, form);
      else await createStudent(form);
      onSuccess();
    } catch (err) {
      alert("오류가 발생했습니다.");
      console.error(err);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[400px] rounded-xl bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-divider)] overflow-hidden">
        {/* Header */}
        <div className="border-b border-[var(--border-divider)] px-5 py-4 bg-[var(--bg-surface-soft)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {isEdit ? "학생 수정" : "학생 등록"}
          </h2>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            정보 수정 후 저장
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

          <input
            name="studentPhone"
            placeholder="학생 전화번호"
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
            name="school"
            placeholder="학교 이름"
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
            rows={3}
            placeholder="메모"
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
            {isEdit ? "수정" : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
