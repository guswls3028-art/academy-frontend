// PATH: src/app_teacher/domains/clinic/pages/ClinicRemoteControlPage.tsx
// 클리닉 리모컨 — 학생 패스카드 배경 3색 실시간 변경 (2초 폴링)
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { ChevronLeft, RefreshCw } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import type { ClinicColorTuple } from "../api";
import { fetchClinicSettings, updateClinicSettings } from "../api";
import styles from "./ClinicRemoteControlPage.module.css";

type CssVariableStyle<TName extends string> = CSSProperties & Record<TName, string>;

type PaletteColor = {
  value: string;
  className: string;
};

const DEFAULT_COLORS: ClinicColorTuple = ["#ef4444", "#3b82f6", "#22c55e"];

const COLOR_PALETTE: PaletteColor[] = [
  { value: "#ef4444", className: styles.paletteRed1 },
  { value: "#dc2626", className: styles.paletteRed2 },
  { value: "#b91c1c", className: styles.paletteRed3 },
  { value: "#991b1b", className: styles.paletteRed4 },
  { value: "#3b82f6", className: styles.paletteBlue1 },
  { value: "#2563eb", className: styles.paletteBlue2 },
  { value: "#1d4ed8", className: styles.paletteBlue3 },
  { value: "#1e40af", className: styles.paletteBlue4 },
  { value: "#22c55e", className: styles.paletteGreen1 },
  { value: "#16a34a", className: styles.paletteGreen2 },
  { value: "#15803d", className: styles.paletteGreen3 },
  { value: "#166534", className: styles.paletteGreen4 },
  { value: "#eab308", className: styles.paletteYellow1 },
  { value: "#ca8a04", className: styles.paletteYellow2 },
  { value: "#a16207", className: styles.paletteYellow3 },
  { value: "#854d0e", className: styles.paletteYellow4 },
  { value: "#a855f7", className: styles.palettePurple1 },
  { value: "#9333ea", className: styles.palettePurple2 },
  { value: "#7e22ce", className: styles.palettePurple3 },
  { value: "#6b21a8", className: styles.palettePurple4 },
  { value: "#ec4899", className: styles.palettePink1 },
  { value: "#db2777", className: styles.palettePink2 },
  { value: "#be185d", className: styles.palettePink3 },
  { value: "#9f1239", className: styles.palettePink4 },
  { value: "#f97316", className: styles.paletteOrange1 },
  { value: "#ea580c", className: styles.paletteOrange2 },
  { value: "#c2410c", className: styles.paletteOrange3 },
  { value: "#9a3412", className: styles.paletteOrange4 },
  { value: "#14b8a6", className: styles.paletteTeal1 },
  { value: "#0d9488", className: styles.paletteTeal2 },
  { value: "#0f766e", className: styles.paletteTeal3 },
  { value: "#115e59", className: styles.paletteTeal4 },
];

export default function ClinicRemoteControlPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const colorDebounceRef = useRef<number | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["teacher-clinic-settings"],
    queryFn: fetchClinicSettings,
    // 폴링 가드: 탭 비가시 상태에서는 정지(default) + 에러 발생 시 backoff(2s→10s).
    // 색상 변경은 실시간성 강하지 않아 가시 상태에서만 충분.
    refetchInterval: (query) => (query.state.error ? 10_000 : 2_000),
    refetchIntervalInBackground: false,
  });

  const colors = settings?.colors ?? DEFAULT_COLORS;

  useEffect(() => {
    return () => {
      if (colorDebounceRef.current) {
        window.clearTimeout(colorDebounceRef.current);
      }
    };
  }, []);

  const updateMut = useMutation({
    mutationFn: (newColors: ClinicColorTuple) => updateClinicSettings({ colors: newColors }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-clinic-settings"] });
      teacherToast.success("배경색이 반영되었습니다.");
    },
    onError: () => teacherToast.error("변경에 실패했습니다."),
  });

  const handlePick = (color: string) => {
    if (pickerIndex === null) return;
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
      colorDebounceRef.current = null;
    }
    const next: ClinicColorTuple = [...colors];
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
    updateMut.mutate([
      COLOR_PALETTE[used[0]].value,
      COLOR_PALETTE[used[1]].value,
      COLOR_PALETTE[used[2]].value,
    ]);
  };

  const handleClosePicker = () => {
    if (colorDebounceRef.current) {
      window.clearTimeout(colorDebounceRef.current);
      colorDebounceRef.current = null;
    }
    setPickerIndex(null);
  };

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  const previewStyle: CssVariableStyle<"--clinic-pass-gradient"> = {
    "--clinic-pass-gradient": `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`,
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backButton} type="button">
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className={styles.title}>클리닉 리모컨</h1>
      </div>

      <div className={styles.description}>
        학생 클리닉 패스카드에 표시되는 3색 배경을 실시간으로 변경합니다. 2초마다 자동 갱신됩니다.
      </div>

      {/* Live preview */}
      <div
        className={styles.preview}
        style={previewStyle}
      >
        <div className={styles.previewInner}>
          <span className={styles.previewText}>PASS</span>
        </div>
      </div>

      {/* Random button */}
      <button onClick={handleRandom} disabled={updateMut.isPending}
        className={styles.randomButton}
        type="button">
        <RefreshCw size={ICON.xs} /> 랜덤 3색 배치
      </button>

      {/* Individual slots */}
      <Card>
        <div className={styles.sectionTitle}>개별 색상 변경</div>
        <div className={styles.slotGrid}>
          {colors.map((c, i) => (
            <button
              key={i}
              onClick={() => setPickerIndex(i)}
              type="button"
              className={styles.slotButton}
              style={{ "--clinic-slot-color": c } as CssVariableStyle<"--clinic-slot-color">}
            >
              {i + 1}
              <div className={styles.slotHex}>{c}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Color picker sheet */}
      <BottomSheet open={pickerIndex !== null} onClose={handleClosePicker} title={`색상 ${(pickerIndex ?? 0) + 1} 선택`}>
        <div className={styles.sheetBody}>
          <div>
            <div className={styles.pickerLabel}>추천 색상</div>
            <div className={styles.paletteGrid}>
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handlePick(color.value)}
                  type="button"
                  className={`${styles.paletteButton} ${color.className}`}
                  title={color.value}
                />
              ))}
            </div>
          </div>
          <div>
            <div className={styles.pickerLabel}>커스텀 색상</div>
            <div className={styles.customColorRow}>
              <input type="color" defaultValue={colors[pickerIndex ?? 0]}
                onChange={(e) => {
                  // Debounce: 드래그 중 mutation 연타 방지 — 선택 완료 후 300ms 지연 발화
                  const val = e.target.value;
                  if (colorDebounceRef.current) window.clearTimeout(colorDebounceRef.current);
                  colorDebounceRef.current = window.setTimeout(() => handlePick(val), 300);
                }}
                className={styles.customColorInput} />
              <span className={styles.customColorHint}>색상 팔레트로 원하는 색을 선택하세요</span>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
