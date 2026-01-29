// PATH: src/features/videos/components/features/video-permission/components/PermissionFilter.tsx

import { useEffect, useState } from "react";

interface Props {
  filters: any;
  setFilters: (f: any) => void;
  onClose: () => void;
}

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "h-8 px-3 rounded-full border text-xs font-semibold transition",
        active
          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
          : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-divider)] hover:bg-[var(--bg-app)]"
      )}
    >
      {label}
    </button>
  );
}

/** ✅ 실제 Attendance 스펙 (8개) */
const ATTENDANCE_OPTIONS = [
  { value: "PRESENT", label: "출석" },
  { value: "LATE", label: "지각" },
  { value: "ONLINE", label: "영상" },
  { value: "SUPPLEMENT", label: "보강" },
  { value: "EARLY_LEAVE", label: "조퇴" },
  { value: "ABSENT", label: "결석" },
  { value: "RUNAWAY", label: "출튀" },
  { value: "MATERIAL", label: "자료" },
] as const;

/** 권한 */
const RULE_OPTIONS = [
  { value: "free", label: "무제한" },
  { value: "once", label: "1회" },
  { value: "blocked", label: "제한" },
] as const;

export default function PermissionFilter({
  filters,
  setFilters,
  onClose,
}: Props) {
  const [local, setLocal] = useState<any>({
    attendance_status: filters.attendance_status ?? "",
    rule: filters.rule ?? "",
    grade: filters.grade ?? "",
  });

  // ✅ 선택 즉시 반영 (적용 버튼 없음)
  useEffect(() => {
    const next: any = {};
    Object.entries(local).forEach(([k, v]) => {
      if (v) next[k] = v;
    });
    setFilters(next);
  }, [local]);

  const reset = () => {
    setLocal({
      attendance_status: "",
      rule: "",
      grade: "",
    });
    setFilters({});
  };

  return (
    <div className="permission-modal-overlay">
      <div className="w-full max-w-[640px] rounded-xl bg-[var(--bg-surface)] shadow-xl">
        {/* HEADER */}
        <div className="px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">필터</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                선택 즉시 반영됩니다
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded border px-3 py-1.5 text-xs"
            >
              닫기
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="px-5 pb-5">
          <div className="rounded-lg bg-[var(--bg-surface-soft)] p-4 space-y-5">
            {/* 출석 */}
            <div>
              <div className="text-xs font-semibold mb-2">출석</div>
              <div className="flex flex-wrap gap-2">
                {ATTENDANCE_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    active={local.attendance_status === o.value}
                    onClick={() =>
                      setLocal({
                        ...local,
                        attendance_status:
                          local.attendance_status === o.value ? "" : o.value,
                      })
                    }
                  />
                ))}
              </div>
            </div>

            {/* 권한 */}
            <div>
              <div className="text-xs font-semibold mb-2">권한</div>
              <div className="flex gap-2">
                {RULE_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    active={local.rule === o.value}
                    onClick={() =>
                      setLocal({
                        ...local,
                        rule: local.rule === o.value ? "" : o.value,
                      })
                    }
                  />
                ))}
              </div>
            </div>

            {/* 학년 */}
            <div>
              <div className="text-xs font-semibold mb-2">학년</div>
              {[
                { label: "초", nums: ["1", "2", "3", "4", "5", "6"] },
                { label: "중", nums: ["1", "2", "3"] },
                { label: "고", nums: ["1", "2", "3"] },
              ].map((g) => (
                <div key={g.label} className="flex items-center gap-2 mb-2">
                  <span className="w-6 text-xs text-[var(--text-muted)]">
                    {g.label}
                  </span>
                  {g.nums.map((n) => {
                    const value = `${g.label}${n}`;
                    return (
                      <Chip
                        key={value}
                        label={n}
                        active={local.grade === value}
                        onClick={() =>
                          setLocal({
                            ...local,
                            grade: local.grade === value ? "" : value,
                          })
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* RESET */}
            <div className="flex justify-end">
              <button
                onClick={reset}
                className="h-8 px-3 text-xs rounded border hover:bg-[var(--bg-app)]"
              >
                전체 초기화
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
