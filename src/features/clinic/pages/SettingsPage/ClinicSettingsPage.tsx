import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchClinicMe } from "../../api/clinicMe.api";
import { fetchClinicSettings, updateClinicSettings } from "../../api/clinicSettings.api";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import AdminModal, { MODAL_WIDTH } from "@/shared/ui/modal/AdminModal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";

export default function ClinicSettingsPage() {
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ["clinic-me"],
    queryFn: fetchClinicMe,
  });

  const canManage = !!meQ.data?.is_payroll_manager || !!meQ.data?.is_superuser;

  if (meQ.isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>;
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-5">
        <div className="text-sm font-semibold">권한이 없습니다.</div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          설정은 관리자만 접근 가능합니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-lg font-semibold">설정</div>
        <div className="text-xs text-[var(--text-muted)]">
          * 정책/기준/자동화 설정은 서버 단일진실로 관리됩니다.
        </div>
      </div>

      {/* 패스카드 배경 색상 설정 */}
      <ClinicIdcardColorSettings />

      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
          <div className="text-sm font-semibold">클리닉 정책</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            * 이 영역은 백엔드 정책 API가 준비되면 그대로 연결합니다.
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] px-5 py-5">
            <div className="text-sm font-semibold">예시</div>
            <div className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              - ProgressPolicy (컷라인/판정 기준)
              <br />
              - 자동 대상자 생성 on/off
              <br />
              - 예약 슬롯(시간/정원) 규칙
              <br />
              * 프론트는 “설정 UI”만 제공하고 저장/검증은 서버가 담당
            </div>
          </div>
        </div>

        <div className="px-5 pb-4">
          <div className="text-[11px] text-[var(--text-muted)]">
            * 설정은 운영 안정성을 위해 “서버 검증”이 반드시 필요합니다.
          </div>
        </div>
      </div>
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
    settings?.colors || ["#ef4444", "#3b82f6", "#22c55e"]
  );

  const updateMutation = useMutation({
    mutationFn: (colors: [string, string, string]) => updateClinicSettings(colors),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-settings"] });
      feedback.success("패스카드 배경 색상이 변경되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail || "색상 저장에 실패했습니다.");
    },
  });

  // 설정 로드 시 로컬 상태 동기화
  useEffect(() => {
    if (settings?.colors) {
      setLocalColors(settings.colors);
    }
  }, [settings?.colors]);

  const presetPalettes: Array<{ name: string; colors: [string, string, string] }> = [
    { name: "빨강-파랑-초록", colors: ["#ef4444", "#3b82f6", "#22c55e"] },
    { name: "주황-보라-핑크", colors: ["#f97316", "#a855f7", "#ec4899"] },
    { name: "청록-노랑-주황", colors: ["#06b6d4", "#eab308", "#f97316"] },
    { name: "보라-핑크-빨강", colors: ["#9333ea", "#ec4899", "#ef4444"] },
    { name: "초록-청록-파랑", colors: ["#22c55e", "#06b6d4", "#3b82f6"] },
    { name: "노랑-주황-빨강", colors: ["#eab308", "#f97316", "#ef4444"] },
  ];

  const [colorSelectModalOpen, setColorSelectModalOpen] = useState(false);
  const [selectingColorIndex, setSelectingColorIndex] = useState<number | null>(null);

  const handleColorChange = (index: number, color: string) => {
    const newColors: [string, string, string] = [...localColors] as [string, string, string];
    newColors[index] = color;
    setLocalColors(newColors);
  };

  const handlePresetSelect = (colors: [string, string, string]) => {
    setLocalColors(colors);
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

  const handleSave = () => {
    updateMutation.mutate(localColors);
  };

  return (
    <>
      <style>{`
        @keyframes idcard-background-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
          <div className="text-sm font-semibold">패스카드 배경 색상 (위조 방지)</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            수업 종료 후 "오늘은 빨 파 초로 해"라고 하면 배경이 해당 색상으로 변경됩니다.
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* 현재 선택된 색상 미리보기 */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--text-muted)]">현재 색상 미리보기</div>
            <div
              className="h-24 rounded-lg border-2 border-[var(--border-divider)]"
              style={{
                background: `linear-gradient(135deg, ${localColors[0]} 0%, ${localColors[1]} 50%, ${localColors[2]} 100%)`,
                backgroundSize: "200% 200%",
                animation: "idcard-background-flow 8s ease infinite",
              }}
            />
          </div>

          {/* 색상 3개 선택 버튼 */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[var(--text-muted)]">색상 선택 (3개)</div>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleOpenColorModal(index)}
                  className="group relative h-20 rounded-lg border-2 border-[var(--border-divider)] overflow-hidden hover:border-[var(--color-primary)] transition-colors flex flex-col items-center justify-center gap-1"
                  style={{
                    background: localColors[index],
                  }}
                >
                  <div className="text-xs font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    색상 {index + 1}
                  </div>
                  <div className="text-[10px] font-mono text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {localColors[index]}
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* 프리셋 팔레트 */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--text-muted)]">빠른 선택</div>
            <div className="grid grid-cols-3 gap-2">
              {presetPalettes.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetSelect(preset.colors)}
                  className="group relative h-16 rounded-lg border-2 border-[var(--border-divider)] overflow-hidden hover:border-[var(--color-primary)] transition-colors"
                  style={{
                    background: `linear-gradient(135deg, ${preset.colors[0]} 0%, ${preset.colors[1]} 50%, ${preset.colors[2]} 100%)`,
                  }}
                  title={preset.name}
                >
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-1 left-1 right-1 text-[10px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {preset.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="pt-2">
            <Button
              intent="primary"
              onClick={handleSave}
              disabled={updateMutation.isPending || isLoading}
              className="w-full"
            >
              {updateMutation.isPending ? "저장 중…" : "색상 저장"}
            </Button>
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
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.mediumModal}>
      <ModalHeader title="색상 선택" onClose={onClose} />
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
                      ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)] ring-offset-2"
                      : "border-[var(--border-divider)] hover:border-[var(--color-primary)]"
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
      <ModalFooter>
        <Button intent="secondary" onClick={onClose}>
          취소
        </Button>
      </ModalFooter>
    </AdminModal>
  );
}
