// PATH: src/features/students/components/StudentCreateModal.tsx

import { useState } from "react";
import { createStudent } from "../api/students";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function StudentCreateModal({ onClose, onSuccess }: Props) {
  const [noPhone, setNoPhone] = useState(false);

  const [form, setForm] = useState({
    name: "",
    gender: "",

    psNumber: "",
    initialPassword: "",

    studentPhone: "",
    omrCode: "",

    parentPhone: "",

    schoolType: "HIGH",
    school: "",
    grade: "",
    schoolClass: "",
    major: "",

    address: "",
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
    if (!form.name.trim()) {
      alert("이름은 필수입니다.");
      return;
    }

    if (!form.psNumber.trim()) {
      alert("PS 번호는 필수입니다.");
      return;
    }

    if (!form.initialPassword || form.initialPassword.trim().length < 4) {
      alert("비밀번호는 4자 이상 필수입니다.");
      return;
    }

    if (noPhone) {
      if (!/^\d{8}$/.test(form.omrCode)) {
        alert("식별자는 숫자 8자리입니다.");
        return;
      }
    } else {
      if (!/^010\d{8}$/.test(form.studentPhone)) {
        alert("학생 전화번호는 010XXXXXXXX 형식입니다.");
        return;
      }
    }

    if (!/^010\d{8}$/.test(form.parentPhone)) {
      alert("학부모 전화번호는 010XXXXXXXX 형식입니다.");
      return;
    }

    try {
      await createStudent({
        ...form,
        noPhone,
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
      <div className="w-[520px] rounded-xl bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-divider)] overflow-hidden">
        {/* Header */}
        <div className="border-b border-[var(--border-divider)] px-5 py-4 bg-[var(--bg-surface-soft)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            학생 등록
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 max-h-[75vh] overflow-y-auto">
          {/* 이름 / 성별 */}
          <div className="flex gap-2">
            <input
              name="name"
              placeholder="이름"
              value={form.name}
              onChange={handleChange}
              className="flex-1 rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)]"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, gender: "M" }))}
                className={`px-3 py-2 text-sm rounded-md border ${
                  form.gender === "M"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-[var(--border-divider)]"
                }`}
              >
                남자
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, gender: "F" }))}
                className={`px-3 py-2 text-sm rounded-md border ${
                  form.gender === "F"
                    ? "bg-pink-500 text-white border-pink-500"
                    : "border-[var(--border-divider)]"
                }`}
              >
                여자
              </button>
            </div>
          </div>

          <input
            name="psNumber"
            placeholder="아이디"
            value={form.psNumber}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)]"
          />

          <input
            name="initialPassword"
            type="password"
            placeholder="비밀번호"
            value={form.initialPassword}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)]"
          />

          {/* 전화번호 / 식별자 */}
          <div className="flex gap-2 items-center">
            <input
              name={noPhone ? "omrCode" : "studentPhone"}
              placeholder={
                noPhone
                  ? "식별자 (8자리)"
                  : "학생 전화번호 (010XXXXXXXX)"
              }
              value={noPhone ? form.omrCode : form.studentPhone}
              onChange={handleChange}
              className="flex-1 rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)]"
            />
            <button
              type="button"
              onClick={() => setNoPhone((v) => !v)}
              className={`px-3 py-2 text-sm rounded-md border ${
                noPhone
                  ? "bg-[var(--color-primary)] text-white"
                  : "border-[var(--border-divider)]"
              }`}
            >
              없음(식별자)
            </button>
          </div>

          <input
            name="parentPhone"
            placeholder="학부모 전화번호 (010XXXXXXXX)"
            value={form.parentPhone}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)]"
          />

          {/* 학교 */}
          <div className="flex gap-2">
            {["HIGH", "MIDDLE"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, schoolType: t }))
                }
                className={`flex-1 px-3 py-2 text-sm rounded-md border ${
                  form.schoolType === t
                    ? "bg-[var(--color-primary)] text-white"
                    : "border-[var(--border-divider)]"
                }`}
              >
                {t === "HIGH" ? "고등학교" : "중학교"}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              name="school"
              placeholder="학교명"
              value={form.school}
              onChange={handleChange}
              className="flex-1 rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)]"
            />
            <div className="flex gap-1">
              {["1", "2", "3"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, grade: g }))}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    form.grade === g
                      ? "bg-[var(--color-primary)] text-white"
                      : "border-[var(--border-divider)]"
                  }`}
                >
                  {g}학년
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              name="schoolClass"
              placeholder="반"
              value={form.schoolClass}
              onChange={handleChange}
              className="flex-1 rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)]"
            />
            <input
              name="major"
              placeholder="계열"
              value={form.major}
              onChange={handleChange}
              className="flex-1 rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)]"
            />
          </div>

          <input
            name="address"
            placeholder="주소"
            value={form.address}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)]"
          />

          <textarea
            name="memo"
            placeholder="메모"
            rows={3}
            value={form.memo}
            onChange={handleChange}
            className="w-full rounded-md px-3 py-2 text-sm border border-[var(--border-divider)] bg-[var(--bg-app)] resize-none"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-divider)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-divider)]"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 text-sm rounded-md bg-[var(--color-primary)] text-white"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
