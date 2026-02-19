// PATH: src/features/clinic/components/ClinicRemoteControl.tsx
// 클리닉 리모컨 - 선생님이 실시간으로 학생 패스카드 배경색 변경

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchClinicSettings, updateClinicSettings } from "../api/clinicSettings.api";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import AdminModal from "@/shared/ui/modal/AdminModal";
import { MODAL_WIDTH } from "@/shared/ui/modal";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";

// 미리 정의된 색상 팔레트
const COLOR_PALETTE = [
  // 빨강 계열
  "#ef4444", "#dc2626", "#b91c1c", "#991b1b",
  // 파랑 계열
  "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af",
  // 초록 계열
  "#22c55e", "#16a34a", "#15803d", "#166534",
  // 노랑 계열
  "#eab308", "#ca8a04", "#a16207", "#854d0e",
  // 보라 계열
  "#a855f7", "#9333ea", "#7e22ce", "#6b21a8",
  // 핑크 계열
  "#ec4899", "#db2777", "#be185d", "#9f1239",
  // 오렌지 계열
  "#f97316", "#ea580c", "#c2410c", "#9a3412",
  // 청록 계열
  "#14b8a6", "#0d9488", "#0f766e", "#115e59",
];

type ColorSelectModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (color: string) => void;
  currentColor: string;
};

function ColorSelectModal({ open, onClose, onSelect, currentColor }: ColorSelectModalProps) {
  const [customColor, setCustomColor] = useState(currentColor || "#ef4444");

  const handleSelect = useCallback(() => {
    onSelect(customColor);
    onClose();
  }, [customColor, onSelect, onClose]);

  return (
    <AdminModal open={open} onClose={onClose} width={MODAL_WIDTH.mediumModal}>
      <ModalHeader title="색상 선택" onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          {/* 미리 정의된 팔레트 */}
          <div>
            <div className="text-sm font-semibold mb-2">추천 색상</div>
            <div className="grid grid-cols-8 gap-2">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setCustomColor(color)}
                  className={`w-10 h-10 rounded-md border-2 transition-all ${
                    customColor === color
                      ? "border-[var(--color-brand-primary)] scale-110"
                      : "border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)]"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* 커스텀 색상 선택 */}
          <div>
            <div className="text-sm font-semibold mb-2">커스텀 색상</div>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-16 h-10 rounded border border-[var(--color-border-divider)] cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-[var(--color-border-divider)] rounded text-sm font-mono"
                placeholder="#ef4444"
              />
            </div>
          </div>

          {/* 미리보기 */}
          <div>
            <div className="text-sm font-semibold mb-2">미리보기</div>
            <div
              className="w-full h-20 rounded-lg border border-[var(--color-border-divider)]"
              style={{ backgroundColor: customColor }}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button intent="secondary" onClick={onClose}>
          취소
        </Button>
        <Button intent="primary" onClick={handleSelect}>
          적용
        </Button>
      </ModalFooter>
    </AdminModal>
  );
}

export default function ClinicRemoteControl() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["clinic-settings"],
    queryFn: fetchClinicSettings,
    refetchInterval: 2000, // 2초마다 자동 갱신 (다른 선생님이 변경했을 경우 대비)
  });

  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);

  const updateMutation = useMutation({
    mutationFn: (colors: [string, string, string]) => updateClinicSettings(colors),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-settings"] });
      qc.invalidateQueries({ queryKey: ["clinic-idcard"] }); // 학생 앱도 갱신되도록
      feedback.success("색상이 즉시 적용되었습니다!");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail || "색상 변경에 실패했습니다.");
    },
  });

  const handleColorSelect = useCallback(
    (index: number) => {
      setSelectedColorIndex(index);
      setColorModalOpen(true);
    },
    []
  );

  const handleColorConfirm = useCallback(
    (color: string) => {
      if (selectedColorIndex === null || !settings) return;
      const newColors: [string, string, string] = [...settings.colors];
      newColors[selectedColorIndex] = color;
      updateMutation.mutate(newColors);
    },
    [selectedColorIndex, settings, updateMutation]
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4">
        <div className="text-sm text-[var(--text-muted)]">불러오는 중...</div>
      </div>
    );
  }

  const colors = settings?.colors || ["#ef4444", "#3b82f6", "#22c55e"];

  return (
    <>
      <div className="rounded-2xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">클리닉 리모컨</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                색상을 선택하면 학생 화면이 즉시 변경됩니다
              </div>
            </div>
            <div className="px-2 py-1 bg-[var(--color-brand-primary)] text-white text-xs font-semibold rounded">
              LIVE
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="space-y-3">
            {/* 현재 색상 미리보기 */}
            <div>
              <div className="text-xs text-[var(--text-muted)] mb-2">현재 배경</div>
              <div
                className="w-full h-16 rounded-lg border border-[var(--border-divider)]"
                style={{
                  background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`,
                  backgroundSize: "200% 200%",
                }}
              />
            </div>

            {/* 색상 선택 버튼 */}
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleColorSelect(index)}
                  className="relative group"
                >
                  <div
                    className="w-full h-20 rounded-lg border-2 border-[var(--border-divider)] transition-all hover:border-[var(--color-brand-primary)] hover:scale-105"
                    style={{ backgroundColor: colors[index] }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
                    <div className="text-xs font-semibold text-white">클릭하여 변경</div>
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">색상 {index + 1}</div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)]">{colors[index]}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ColorSelectModal
        open={colorModalOpen}
        onClose={() => {
          setColorModalOpen(false);
          setSelectedColorIndex(null);
        }}
        onSelect={handleColorConfirm}
        currentColor={selectedColorIndex !== null ? colors[selectedColorIndex] : "#ef4444"}
      />
    </>
  );
}
