import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "antd";
import { fetchClinicMe } from "../../api/clinicMe.api";
import { fetchClinicSettings, updateClinicSettings } from "../../api/clinicSettings.api";
import Section from "@/shared/ui/ds/Section";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import AdminModal from "@/shared/ui/modal/AdminModal";
import { MODAL_WIDTH } from "@/shared/ui/modal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";

export default function ClinicSettingsPage() {
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ["clinic-me"],
    queryFn: fetchClinicMe,
    retry: 1,
  });

  const canManage =
    meQ.data &&
    (meQ.data.is_staff || meQ.data.is_payroll_manager || meQ.data.is_superuser);

  if (meQ.isLoading) {
    return (
      <div className="clinic-page">
        <Section title="패스카드" description="불러오는 중…" />
      </div>
    );
  }

  if (meQ.isError) {
    return (
      <div className="clinic-page">
        <Section
          title="패스카드"
          description="권한 정보를 불러오지 못했습니다. 네트워크를 확인한 뒤 새로고침해 주세요."
        />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="clinic-page">
        <Section
          title="권한 없음"
          description="패스카드 설정은 스태프(관리자)만 접근할 수 있습니다."
        />
      </div>
    );
  }

  return (
    <div className="clinic-page space-y-0">
      <ClinicIdcardColorSettings />
    </div>
  );
}

/** 패스카드 배경 색상 설정 컴포넌트 */
function ClinicIdcardColorSettings() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["clinic-settings"],
    queryFn: fetchClinicSettings,
  });

  const [localColors, setLocalColors] = useState<[string, string, string]>(
    settings?.saved_colors || settings?.colors || ["#ef4444", "#3b82f6", "#22c55e"]
  );

  const updateMutation = useMutation({
    mutationFn: (payload: { colors?: [string, string, string]; use_daily_random?: boolean }) =>
      updateClinicSettings(payload.colors, payload.use_daily_random),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-settings"] });
      qc.invalidateQueries({ queryKey: ["clinic-idcard"] });
      feedback.success("설정이 저장되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail || "저장에 실패했습니다.");
    },
  });

  const useDailyRandom = settings?.use_daily_random ?? false;

  // 설정 로드 시 로컬 상태 동기화 (수동 색상)
  useEffect(() => {
    const saved = settings?.saved_colors || settings?.colors;
    if (saved) {
      setLocalColors([saved[0], saved[1], saved[2]]);
    }
  }, [settings?.saved_colors, settings?.colors]);

  const handleToggleDailyRandom = (checked: boolean) => {
    updateMutation.mutate({ use_daily_random: checked });
  };

  const handleSave = () => {
    updateMutation.mutate({ colors: localColors });
  };

  /** 팔레트에서 서로 다른 3색 랜덤 선택 (로컬만) */
  const handleAutoAssign = () => {
    const palette = [
      "#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ec4899",
      "#eab308", "#06b6d4", "#84cc16", "#f43f5e", "#6366f1", "#14b8a6",
    ];
    const indices: number[] = [];
    while (indices.length < 3) {
      const i = Math.floor(Math.random() * palette.length);
      if (!indices.includes(i)) indices.push(i);
    }
    setLocalColors([palette[indices[0]], palette[indices[1]], palette[indices[2]]]);
  };

  /** 3색 랜덤 배치 후 즉시 서버에 반영 (새로고침) */
  const handleRefresh = () => {
    const palette = [
      "#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ec4899",
      "#eab308", "#06b6d4", "#84cc16", "#f43f5e", "#6366f1", "#14b8a6",
    ];
    const indices: number[] = [];
    while (indices.length < 3) {
      const i = Math.floor(Math.random() * palette.length);
      if (!indices.includes(i)) indices.push(i);
    }
    const newColors: [string, string, string] = [palette[indices[0]], palette[indices[1]], palette[indices[2]]];
    setLocalColors(newColors);
    updateMutation.mutate({ colors: newColors });
  };

  const [colorSelectModalOpen, setColorSelectModalOpen] = useState(false);
  const [selectingColorIndex, setSelectingColorIndex] = useState<number | null>(null);

  const handleColorChange = (index: number, color: string) => {
    const newColors: [string, string, string] = [...localColors] as [string, string, string];
    newColors[index] = color;
    setLocalColors(newColors);
  };

  const handleOpenColorModal = (index: number) => {
    setSelectingColorIndex(index);
    setColorSelectModalOpen(true);
  };

  const handleColorSelect = (color: string) => {
    if (selectingColorIndex !== null) {
      handleColorChange(selectingColorIndex, color);
    }
    setColorSelectModalOpen(false);
    setSelectingColorIndex(null);
  };

  return (
    <>
      <div className="clinic-panel overflow-hidden">
        <div className="clinic-panel__header">
          <h2 className="clinic-panel__title">클리닉 패스카드</h2>
          <p className="clinic-panel__meta">위조 방지 · 수업 후 색상 변경</p>
        </div>
        <div className="clinic-panel__body">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-4 py-3">
              <div>
                <p className="clinic-panel__title text-base">매일 자동 색상</p>
                <p className="clinic-panel__meta">날짜마다 다른 3색 자동 적용</p>
              </div>
              <Switch
                checked={useDailyRandom}
                onChange={handleToggleDailyRandom}
                disabled={updateMutation.isPending}
              />
            </div>

            {useDailyRandom && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--color-text-muted)]">오늘 미리보기</p>
                <div
                  className="w-full h-16 rounded-lg border-2 border-[var(--color-border-divider)] clinic-passcard-gradient-flow"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${(settings?.colors || localColors)[0]} 0%, ${(settings?.colors || localColors)[1]} 50%, ${(settings?.colors || localColors)[2]} 100%)`,
                    backgroundSize: "200% 200%",
                    animation: "idcard-background-flow 8s ease infinite",
                  }}
                />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                {useDailyRandom ? "수동 모드용 색상" : "현재 색상"}
              </p>
              <div
                className="w-full h-16 rounded-lg border-2 border-[var(--color-border-divider)] clinic-passcard-gradient-flow"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${localColors[0]} 0%, ${localColors[1]} 50%, ${localColors[2]} 100%)`,
                  backgroundSize: "200% 200%",
                  animation: "idcard-background-flow 8s ease infinite",
                }}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs font-semibold text-[var(--color-text-muted)]">색상 3개</p>
                <Button intent="secondary" size="sm" onClick={handleAutoAssign} className="shrink-0">
                  자동 부여
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleOpenColorModal(index)}
                    className="group relative h-20 rounded-lg border-2 border-[var(--color-border-divider)] overflow-hidden hover:border-[var(--color-brand-primary)] transition-colors flex flex-col items-center justify-center gap-1"
                    style={{ background: localColors[index] }}
                  >
                    <span className="text-xs font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {index + 1}
                    </span>
                    <span className="text-[10px] font-mono text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {localColors[index]}
                    </span>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Button
                type="button"
                intent="secondary"
                size="xl"
                onClick={handleRefresh}
                disabled={updateMutation.isPending || isLoading}
                className="w-full clinic-passcard-refresh-btn"
              >
                🔄 새로고침 — 3색 랜덤 배치 즉시 반영
              </Button>
              <Button
                intent="primary"
                onClick={handleSave}
                disabled={updateMutation.isPending || isLoading}
                className="w-full"
              >
                {updateMutation.isPending ? "저장 중…" : "저장"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 색상 선택 모달 */}
      <ColorSelectModal
        open={colorSelectModalOpen}
        onClose={() => {
          setColorSelectModalOpen(false);
          setSelectingColorIndex(null);
        }}
        onSelect={handleColorSelect}
        currentColor={selectingColorIndex !== null ? localColors[selectingColorIndex] : null}
      />
    </>
  );
}

/** 색상 선택 모달 컴포넌트 */
function ColorSelectModal({
  open,
  onClose,
  onSelect,
  currentColor,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (color: string) => void;
  currentColor: string | null;
}) {
  // 기본 색상 팔레트
  const colorPalette: Array<{ name: string; color: string }> = [
    { name: "빨강", color: "#ef4444" },
    { name: "파랑", color: "#3b82f6" },
    { name: "초록", color: "#22c55e" },
    { name: "주황", color: "#f97316" },
    { name: "보라", color: "#a855f7" },
    { name: "핑크", color: "#ec4899" },
    { name: "노랑", color: "#eab308" },
    { name: "청록", color: "#06b6d4" },
    { name: "검정", color: "#000000" },
    { name: "흰색", color: "#ffffff" },
    { name: "회색", color: "#6b7280" },
    { name: "갈색", color: "#92400e" },
  ];

  const [customColor, setCustomColor] = useState(currentColor || "#ef4444");

  useEffect(() => {
    if (currentColor) {
      setCustomColor(currentColor);
    }
  }, [currentColor]);

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.md} onEnterConfirm={() => onSelect(customColor)}>
      <ModalHeader title="색상 선택" />
      <ModalBody>
        <div className="p-5 space-y-4">
          {/* 기본 색상 팔레트 */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">기본 색상</div>
            <div className="grid grid-cols-6 gap-2">
              {colorPalette.map((item) => (
                <button
                  key={item.color}
                  type="button"
                  onClick={() => onSelect(item.color)}
                  className={`h-12 rounded-lg border-2 transition-all hover:scale-105 ${
                    currentColor === item.color
                      ? "border-[var(--color-brand-primary)] ring-2 ring-[var(--color-brand-primary)] ring-offset-2"
                      : "border-[var(--border-divider)] hover:border-[var(--color-brand-primary)]"
                  }`}
                  style={{ background: item.color }}
                  title={item.name}
                >
                  <span className="sr-only">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 커스텀 색상 선택 */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">커스텀 색상</div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="h-12 w-12 rounded-lg border-2 border-[var(--border-divider)] cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    setCustomColor(e.target.value);
                  }
                }}
                className="flex-1 h-12 px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] font-mono text-sm"
                placeholder="#RRGGBB"
              />
              <Button
                intent="primary"
                onClick={() => onSelect(customColor)}
                className="h-12 px-4"
              >
                선택
              </Button>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <Button intent="secondary" onClick={onClose}>
            취소
          </Button>
        }
      />
    </AdminModal>
  );
}
