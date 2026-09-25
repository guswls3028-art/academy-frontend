import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchClinicSettings, updateClinicSettings } from "../../api/clinicSettings.api";
import { clinicQueryKeys } from "../../queryKeys";
import styles from "./ClinicPasscardPage.module.css";

type ColorTuple = [string, string, string];
type PreviewState = "passed" | "confirmed" | "pending" | "required";

const PREVIEW_STATES: { key: PreviewState; label: string; eyebrow: string; verdict: string; help: string }[] = [
  { key: "passed", label: "합격", eyebrow: "과락 요소 없음", verdict: "합격자", help: "선생님께 이 화면을 보여 주세요." },
  { key: "confirmed", label: "예약 완료", eyebrow: "다음 클리닉 예약됨", verdict: "예약완료", help: "다음 클리닉 수강완료 처리 전까지 예약완료 상태를 유지합니다." },
  { key: "pending", label: "승인 대기", eyebrow: "클리닉 대상 · 승인 대기", verdict: "대상자", help: "예약 승인을 기다리고 있습니다. 승인되면 예약완료로 바뀝니다." },
  { key: "required", label: "예약 필요", eyebrow: "과락 요소 있음", verdict: "대상자", help: "미해결 항목이 있습니다. 다음 클리닉 일정을 예약해 주세요." },
];

const DEFAULT_COLORS: ColorTuple = ["#ef4444", "#3b82f6", "#22c55e"];
const PALETTE = [
  "#ef4444", "#dc2626", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#3b82f6", "#2563eb",
  "#8b5cf6", "#a855f7", "#ec4899", "#be123c",
];

function errorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "패스카드 설정 저장에 실패했습니다.";
  const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
  return typeof detail === "string" ? detail : "패스카드 설정 저장에 실패했습니다.";
}

export default function ClinicPasscardPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: clinicQueryKeys.settings,
    queryFn: fetchClinicSettings,
    staleTime: 30_000,
  });
  const [colors, setColors] = useState<ColorTuple>(DEFAULT_COLORS);
  const [dailyRandom, setDailyRandom] = useState(true);
  const [previewState, setPreviewState] = useState<PreviewState>("passed");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setColors(settingsQuery.data.saved_colors ?? settingsQuery.data.colors);
    setDailyRandom(!!settingsQuery.data.use_daily_random);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateClinicSettings(colors, dailyRandom),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: clinicQueryKeys.settings });
      feedback.success("패스카드 설정이 학생 화면에 반영되었습니다.");
    },
    onError: (error: unknown) => feedback.error(errorMessage(error)),
  });

  const previewColors = dailyRandom && settingsQuery.data?.use_daily_random
    ? settingsQuery.data.colors : colors;
  const gradient = useMemo(
    () => `linear-gradient(135deg, ${previewColors[0]} 0%, ${previewColors[1]} 50%, ${previewColors[2]} 100%)`,
    [previewColors],
  );
  const selectedPreview = PREVIEW_STATES.find((state) => state.key === previewState) ?? PREVIEW_STATES[0];

  const updateColor = (index: number, value: string) => {
    setColors((current) => current.map((color, colorIndex) => colorIndex === index ? value : color) as ColorTuple);
  };

  const randomize = () => {
    const shuffled = [...PALETTE].sort(() => Math.random() - 0.5);
    setColors([shuffled[0], shuffled[1], shuffled[2]]);
    setDailyRandom(false);
  };

  if (settingsQuery.isLoading) {
    return <div className={styles.state} role="status">패스카드 설정을 불러오는 중…</div>;
  }

  if (settingsQuery.isError) {
    return (
      <div className={`${styles.state} ${styles.error}`} role="alert">
        <strong>패스카드 설정을 불러오지 못했습니다.</strong>
        <Button intent="secondary" onClick={() => settingsQuery.refetch()}>다시 시도</Button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>수업 종료 확인 화면</span>
          <h2>클리닉 패스카드</h2>
          <p>학생 화면에 나타나는 상태를 살펴보고 합격 카드의 색상을 설정합니다. 학생 패스카드는 2초마다 판정과 색상을 새로 확인합니다.</p>
        </div>
        <span className={styles.live}>학생 화면 예시</span>
      </section>

      <div className={styles.grid}>
        <section className={styles.previewPanel} aria-labelledby="passcard-preview-title">
          <div className={styles.sectionHeading}>
            <div>
              <span>미리보기</span>
              <h3 id="passcard-preview-title">학생 화면 예시</h3>
            </div>
          </div>
          <div className={styles.previewChoices} role="group" aria-label="학생 상태 미리보기">
            {PREVIEW_STATES.map((state) => (
              <button key={state.key} type="button" aria-pressed={previewState === state.key}
                className={previewState === state.key ? styles.previewChoiceActive : ""}
                onClick={() => setPreviewState(state.key)}>{state.label}</button>
            ))}
          </div>
          {/* 색상은 테넌트 설정값이므로 정적 CSS class로 표현할 수 없습니다. */}
          <div className={`${styles.preview} ${previewState === "confirmed" ? styles.previewConfirmed : ""} ${previewState === "required" || previewState === "pending" ? styles.previewRequired : ""}`}
            style={previewState === "passed" ? { backgroundImage: gradient } : undefined}>
            <span className={styles.previewLive}>표시 예시</span>
            <div className={`${styles.previewCard} ${previewState !== "passed" ? styles.previewCardDark : ""}`}>
              <span>{selectedPreview.eyebrow}</span>
              <strong>{selectedPreview.verdict}</strong>
              <p>{selectedPreview.help}</p>
            </div>
          </div>
          <p className={styles.previewExplanation}>
            {previewState === "passed" ? "미통과 항목이 해결된 상태입니다. 합격 카드에만 아래 색상 설정이 적용됩니다." :
              previewState === "confirmed" ? "예약이 확정되어도 미통과 항목은 수강·처리 전까지 남습니다. 파란 화면으로 표시됩니다." :
                previewState === "pending" ? "예약을 신청했고 직원 승인을 기다리는 상태입니다. 검은 화면으로 표시됩니다." :
                  "해결되지 않은 항목이 있고 유효한 예약이 없는 상태입니다. 검은 화면으로 표시됩니다."}
          </p>
        </section>

        <section className={styles.controls} aria-labelledby="passcard-colors-title">
          <div className={styles.sectionHeading}>
            <div>
              <span>색상 설정</span>
              <h3 id="passcard-colors-title">합격 카드 3색</h3>
            </div>
            <button type="button" className={styles.randomButton} onClick={randomize}>3색 랜덤 배치</button>
          </div>
          <div className={styles.colorGrid}>
            {colors.map((color, index) => (
              <label key={index} className={styles.colorControl}>
                <span>색상 {index + 1}</span>
                <input
                  type="color"
                  value={color}
                  onChange={(event) => updateColor(index, event.target.value)}
                  aria-label={`패스카드 색상 ${index + 1}`}
                />
                <code>{color.toUpperCase()}</code>
              </label>
            ))}
          </div>
          <label className={styles.dailyRandom}>
            <input
              type="checkbox"
              checked={dailyRandom}
              onChange={(event) => setDailyRandom(event.target.checked)}
            />
            <span>
              <strong>매일 자동으로 색상 바꾸기</strong>
              <small>새 학원은 기본으로 켜져 있습니다. 켜면 저장한 색상 대신 날짜 기준 3색을 자동 표시합니다.</small>
            </span>
          </label>
          <div className={styles.note}>예약 완료는 파란 화면, 예약 필요·승인 대기는 검은 화면입니다. 이 색상 설정은 합격 카드에만 적용됩니다.</div>
          <div className={styles.actions}>
            <Button
              intent="primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "저장 중…" : "학생 화면에 적용"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
