// PATH: src/features/materials/sheets/SheetsCreatePage.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { PageSection } from "@/shared/ui/page";
import { createSheetApi } from "./sheets.api";

type CreateMode = "preset" | "custom";
type PresetType = "objective_subjective" | "subjective_only";

export default function SheetsCreatePage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<CreateMode>("preset");
  const [preset, setPreset] = useState<PresetType>("objective_subjective");
  const [questionCount, setQuestionCount] = useState<10 | 20 | 30>(20);

  const canProceed = useMemo(() => title.trim().length > 0, [title]);

  const createMut = useMutation({
    mutationFn: async () => {
      const sheet = await createSheetApi({
        title: title.trim(),
        questionCount,
        mode,
      });
      return sheet;
    },
    onSuccess: (sheet) => {
      navigate(`/admin/materials/sheets/${sheet.id}/edit`);
    },
    onError: (e: any) => {
      alert(e?.message || "시험지 생성 실패");
    },
  });

  const Pill = ({
    active,
    label,
    sub,
    onClick,
    disabled,
  }: {
    active: boolean;
    label: string;
    sub: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      tabIndex={-1}
      className={[
        "rounded-xl border p-4 text-left transition",
        active ? "border-[var(--color-primary)] shadow-sm bg-[var(--bg-surface)]" : "bg-[var(--bg-surface)]",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--bg-surface-soft)]",
      ].join(" ")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => !disabled && onClick()}
      disabled={disabled}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">{sub}</div>
        </div>
        {active && (
          <span className="inline-flex items-center rounded-full bg-[var(--color-primary)] px-2 py-1 text-[11px] text-[var(--text-on-primary)]">
            선택됨
          </span>
        )}
        {disabled && !active && (
          <span className="inline-flex items-center rounded-full border px-2 py-1 text-[11px]">비활성</span>
        )}
      </div>
    </button>
  );

  return (
    <PageSection
      title="시험지 생성"
      description="시험 전에 사용할 시험지 상품을 제작합니다."
      right={
        <button className="btn" onClick={() => navigate("/admin/materials/sheets")}>
          목록
        </button>
      }
    >
      <div className="surface p-4 space-y-6">
        <div className="rounded border bg-[var(--bg-surface-soft)] p-4">
          <div className="text-sm font-semibold">상품 제작 흐름</div>
          <div className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
            ① 시험지 생성 → ② 원본 업로드/문항 매칭 → ③ OMR 오버레이에서 정답·배점 저장
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded border bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">시험지 이름</div>
            <input
              className="w-full rounded border px-3 py-2 text-sm bg-[var(--bg-surface)]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 3월 모의고사 시험지"
            />
            <div className="text-[11px] text-[var(--text-muted)]">시험지 이름은 시험에서 선택할 때 그대로 노출됩니다.</div>
          </div>

          <div className="rounded border bg-[var(--bg-surface)] p-4 space-y-3">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">생성 방식</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Pill
                active={mode === "preset"}
                label="기본 제공 시험지"
                sub="OMR Objective v1 기준을 즉시 적용합니다."
                onClick={() => setMode("preset")}
              />
              <Pill
                active={mode === "custom"}
                label="커스텀 답안지 업로드"
                sub="파일 업로드 기반 제작 (현재 비활성)"
                onClick={() => setMode("custom")}
                disabled
              />
            </div>
          </div>
        </div>

        <div className="rounded border bg-[var(--bg-surface)] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">시험지 구성</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">
                OMR Objective v1은 10/20/30문항만 지원하며, A–E 객관식입니다.
              </div>
            </div>
            <span className="inline-flex items-center rounded-full border bg-[var(--bg-surface-soft)] px-3 py-1 text-[11px]">
              OMR Objective v1 고정
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Pill
              active={preset === "objective_subjective"}
              label="객관 + 서술 혼합"
              sub="기본 제공 시험지 3종 구성"
              onClick={() => setPreset("objective_subjective")}
            />
            <Pill
              active={preset === "subjective_only"}
              label="서술형 전용"
              sub="서술형 답안지 1종 구성"
              onClick={() => setPreset("subjective_only")}
            />
          </div>

          <div className="rounded border bg-[var(--bg-surface-soft)] p-3">
            <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">문항 수 (객관식)</div>
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30].map((c) => (
                <button
                  key={c}
                  type="button"
                  tabIndex={-1}
                  className={["btn", questionCount === c ? "border-[var(--color-primary)] text-[var(--color-primary)]" : ""].join(
                    " "
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setQuestionCount(c as 10 | 20 | 30)}
                >
                  {c}문항
                </button>
              ))}
            </div>
          </div>

          <div className="rounded border border-dashed bg-[var(--bg-surface)] p-4">
            <div className="text-sm font-semibold">커스텀 업로드</div>
            <div className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
              커스텀 답안지 업로드 기능은 현재 비활성화되어 있습니다.
              <br />
              기본 제공 시험지로 즉시 운영이 가능합니다.
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn" onClick={() => navigate("/admin/materials/sheets")}>
            취소
          </button>
          <button className="btn-primary" disabled={!canProceed || createMut.isPending} onClick={() => createMut.mutate()}>
            {createMut.isPending ? "생성 중..." : "생성하고 편집하기"}
          </button>
        </div>
      </div>
    </PageSection>
  );
}
