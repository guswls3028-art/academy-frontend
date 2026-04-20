// PATH: src/app_teacher/domains/clinic/pages/ClinicRemoteControlPage.tsx
// 클리닉 리모컨 — 학생 패스카드 배경 3색 실시간 변경 (2초 폴링)
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, RefreshCw } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { fetchClinicSettings, updateClinicSettings } from "../api";

const COLOR_PALETTE = [
  "#ef4444", "#dc2626", "#b91c1c", "#991b1b",
  "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af",
  "#22c55e", "#16a34a", "#15803d", "#166534",
  "#eab308", "#ca8a04", "#a16207", "#854d0e",
  "#a855f7", "#9333ea", "#7e22ce", "#6b21a8",
  "#ec4899", "#db2777", "#be185d", "#9f1239",
  "#f97316", "#ea580c", "#c2410c", "#9a3412",
  "#14b8a6", "#0d9488", "#0f766e", "#115e59",
];

export default function ClinicRemoteControlPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const colorDebounceRef = useRef<number | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["teacher-clinic-settings"],
    queryFn: fetchClinicSettings,
    refetchInterval: 2000,
  });

  const colors: [string, string, string] = settings?.colors || ["#ef4444", "#3b82f6", "#22c55e"];

  const updateMut = useMutation({
    mutationFn: (newColors: [string, string, string]) => updateClinicSettings({ colors: newColors } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-clinic-settings"] });
      teacherToast.success("배경색이 반영되었습니다.");
    },
    onError: () => teacherToast.error("변경에 실패했습니다."),
  });

  const handlePick = (color: string) => {
    if (pickerIndex === null) return;
    const next: [string, string, string] = [...colors];
    next[pickerIndex] = color;
    updateMut.mutate(next);
    setPickerIndex(null);
  };

  const handleRandom = () => {
    const used: number[] = [];
    while (used.length < 3) {
      const i = Math.floor(Math.random() * COLOR_PALETTE.length);
      if (!used.includes(i)) used.push(i);
    }
    updateMut.mutate([COLOR_PALETTE[used[0]], COLOR_PALETTE[used[1]], COLOR_PALETTE[used[2]]]);
  };

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>클리닉 리모컨</h1>
      </div>

      <div className="text-[12px] px-1" style={{ color: "var(--tc-text-muted)", lineHeight: 1.5 }}>
        학생 클리닉 패스카드에 표시되는 3색 배경을 실시간으로 변경합니다. 2초마다 자동 갱신됩니다.
      </div>

      {/* Live preview */}
      <div className="rounded-2xl"
        style={{
          height: 180,
          background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`,
          border: "1px solid var(--tc-border)",
        }}>
        <div className="h-full flex items-center justify-center">
          <span className="text-white font-bold text-lg"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
            PASS
          </span>
        </div>
      </div>

      {/* Random button */}
      <button onClick={handleRandom} disabled={updateMut.isPending}
        className="flex items-center justify-center gap-2 text-sm font-bold cursor-pointer"
        style={{
          padding: "14px",
          borderRadius: "var(--tc-radius)",
          border: "none",
          background: "var(--tc-primary)",
          color: "#fff",
          opacity: updateMut.isPending ? 0.6 : 1,
        }}>
        <RefreshCw size={14} /> 랜덤 3색 배치
      </button>

      {/* Individual slots */}
      <Card>
        <div className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>개별 색상 변경</div>
        <div className="grid grid-cols-3 gap-2">
          {colors.map((c, i) => (
            <button key={i} onClick={() => setPickerIndex(i)} type="button"
              className="rounded-lg cursor-pointer"
              style={{
                aspectRatio: "1 / 1",
                background: c,
                border: "1px solid var(--tc-border)",
                color: "#fff",
                textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                fontWeight: 700,
                fontSize: 12,
              }}>
              {i + 1}
              <div className="text-[10px] mt-1 opacity-80">{c}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Color picker sheet */}
      <BottomSheet open={pickerIndex !== null} onClose={() => setPickerIndex(null)} title={`색상 ${(pickerIndex ?? 0) + 1} 선택`}>
        <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
          <div>
            <div className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--tc-text-muted)" }}>추천 색상</div>
            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button key={c} onClick={() => handlePick(c)} type="button"
                  style={{
                    aspectRatio: "1 / 1",
                    borderRadius: "var(--tc-radius-sm)",
                    background: c,
                    border: "1.5px solid var(--tc-border)",
                    cursor: "pointer",
                  }}
                  title={c} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--tc-text-muted)" }}>커스텀 색상</div>
            <div className="flex items-center gap-2">
              <input type="color" defaultValue={colors[pickerIndex ?? 0]}
                onChange={(e) => {
                  // Debounce: 드래그 중 mutation 연타 방지 — 선택 완료 후 300ms 지연 발화
                  const val = e.target.value;
                  if (colorDebounceRef.current) window.clearTimeout(colorDebounceRef.current);
                  colorDebounceRef.current = window.setTimeout(() => handlePick(val), 300);
                }}
                style={{ width: 48, height: 40, borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", cursor: "pointer" }} />
              <span className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>색상 팔레트로 원하는 색을 선택하세요</span>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
