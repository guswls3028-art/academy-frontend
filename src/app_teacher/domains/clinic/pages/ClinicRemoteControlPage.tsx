import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, ICON } from "@/shared/ui/ds";
import { InlineHelp } from "@/shared/ui/guide";
import { ChevronLeft, RefreshCw } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import type { ClinicColorTuple } from "../api";
import { fetchClinicSettings, updateClinicSettings } from "../api";
import { teacherClinicQueryKeys } from "../queryKeys";
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
  const queryClient = useQueryClient();
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const colorDebounceRef = useRef<number | null>(null);

  const settingsQuery = useQuery({
    queryKey: teacherClinicQueryKeys.settings,
    queryFn: fetchClinicSettings,
    refetchInterval: (query) => query.state.error ? 10_000 : 2_000,
    refetchIntervalInBackground: false,
  });
  const colors = settingsQuery.data?.colors ?? DEFAULT_COLORS;

  useEffect(() => () => {
    if (colorDebounceRef.current) window.clearTimeout(colorDebounceRef.current);
  }, []);

  const updateMutation = useMutation({
    mutationFn: (nextColors: ClinicColorTuple) => updateClinicSettings({ colors: nextColors }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: teacherClinicQueryKeys.settings });
      teacherToast.success("패스카드 색상이 반영되었습니다.");
    },
    onError: () => teacherToast.error("색상 변경에 실패했습니다."),
  });

  const applyColor = (color: string) => {
    if (pickerIndex === null) return;
    const next: ClinicColorTuple = [...colors];
    next[pickerIndex] = color;
    updateMutation.mutate(next);
    setPickerIndex(null);
  };

  const applyRandomColors = () => {
    const shuffled = [...COLOR_PALETTE].sort(() => Math.random() - 0.5);
    updateMutation.mutate([shuffled[0].value, shuffled[1].value, shuffled[2].value]);
  };

  if (settingsQuery.isLoading) {
    return <EmptyState scope="panel" tone="loading" title="패스카드 색상을 불러오는 중…" />;
  }

  if (settingsQuery.isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="패스카드 색상을 불러오지 못했습니다."
        actions={<Button intent="secondary" onClick={() => settingsQuery.refetch()}>다시 시도</Button>}
      />
    );
  }

  const previewStyle: CssVariableStyle<"--clinic-pass-gradient"> = {
    "--clinic-pass-gradient": `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`,
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backButton} type="button" aria-label="뒤로 가기">
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className={styles.title}>패스카드 색상</h1>
        <InlineHelp
          title="패스카드 색상 안내"
          tone="teacher"
          align="right"
          ariaLabel="패스카드 색상 도움말"
          iconSize={15}
        >
          <p>합격한 학생 패스카드에 표시되는 3색 배경을 변경합니다.</p>
          <p>학생 화면은 2초마다 자동으로 새 색상을 확인합니다.</p>
        </InlineHelp>
      </div>

      <div className={styles.preview} style={previewStyle}>
        <span className={styles.previewLive}>● LIVE</span>
        <div className={styles.previewInner}>
          <span className={styles.previewText}>합격</span>
        </div>
      </div>

      <button
        onClick={applyRandomColors}
        disabled={updateMutation.isPending}
        className={styles.randomButton}
        type="button"
      >
        <RefreshCw size={ICON.xs} /> 3색 랜덤 배치
      </button>

      <Card>
        <div className={styles.sectionTitle}>개별 색상 변경</div>
        <div className={styles.slotGrid}>
          {colors.map((color, index) => (
            <button
              key={index}
              onClick={() => setPickerIndex(index)}
              type="button"
              className={styles.slotButton}
              style={{ "--clinic-slot-color": color } as CssVariableStyle<"--clinic-slot-color">}
              aria-label={`색상 ${index + 1} 변경`}
            >
              색상 {index + 1}
              <span className={styles.slotHex}>{color.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </Card>

      <BottomSheet
        open={pickerIndex !== null}
        onClose={() => setPickerIndex(null)}
        title={`색상 ${(pickerIndex ?? 0) + 1} 선택`}
      >
        <div className={styles.sheetBody}>
          <div>
            <div className={styles.pickerLabel}>추천 색상</div>
            <div className={styles.paletteGrid}>
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color.value}
                  onClick={() => applyColor(color.value)}
                  type="button"
                  className={`${styles.paletteButton} ${color.className}`}
                  aria-label={`${color.value} 선택`}
                />
              ))}
            </div>
          </div>
          <div>
            <div className={styles.pickerLabel}>직접 선택</div>
            <div className={styles.customColorRow}>
              <input
                type="color"
                defaultValue={colors[pickerIndex ?? 0]}
                onChange={(event) => {
                  const value = event.target.value;
                  if (colorDebounceRef.current) window.clearTimeout(colorDebounceRef.current);
                  colorDebounceRef.current = window.setTimeout(() => applyColor(value), 300);
                }}
                className={styles.customColorInput}
                aria-label="직접 고른 색상 적용"
              />
              <span className={styles.customColorHint}>원하는 색상을 고르면 학생 화면에 바로 반영됩니다.</span>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
