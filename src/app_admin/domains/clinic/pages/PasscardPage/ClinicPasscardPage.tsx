import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchClinicSettings, updateClinicSettings } from "../../api/clinicSettings.api";
import { clinicQueryKeys } from "../../queryKeys";
import styles from "./ClinicPasscardPage.module.css";

type ColorTuple = [string, string, string];

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
  const [dailyRandom, setDailyRandom] = useState(false);

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

  const gradient = useMemo(
    () => `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`,
    [colors],
  );

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
          <p>합격한 학생 화면에 표시할 3가지 색상을 정합니다. 학생 패스카드는 2초마다 판정과 색상을 새로 확인합니다.</p>
        </div>
        <span className={styles.live}><i aria-hidden /> 학생 화면 LIVE</span>
      </section>

      <div className={styles.grid}>
        <section className={styles.previewPanel} aria-labelledby="passcard-preview-title">
          <div className={styles.sectionHeading}>
            <div>
              <span>미리보기</span>
              <h3 id="passcard-preview-title">학생 합격 화면</h3>
            </div>
            <button type="button" className={styles.randomButton} onClick={randomize}>3색 랜덤 배치</button>
          </div>
          {/* 색상은 테넌트 설정값이므로 정적 CSS class로 표현할 수 없습니다. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <div className={styles.preview} style={{ backgroundImage: gradient }}>
            <span className={styles.previewLive}>● LIVE</span>
            <div className={styles.previewCard}>
              <span>오늘 수업 완료</span>
              <strong>합격</strong>
              <p>선생님께 이 화면을 보여 주세요.</p>
            </div>
          </div>
        </section>

        <section className={styles.controls} aria-labelledby="passcard-colors-title">
          <div className={styles.sectionHeading}>
            <div>
              <span>색상 설정</span>
              <h3 id="passcard-colors-title">합격 카드 3색</h3>
            </div>
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
              <small>켜면 저장한 색상 대신 날짜 기준 3색을 자동 표시합니다.</small>
            </span>
          </label>
          <div className={styles.note}>
            클리닉 대상 학생은 선택한 색상 대신 검은색 경고 화면과 “클리닉 예약 대상자” 문구가 표시됩니다.
          </div>
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
