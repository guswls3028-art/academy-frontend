import { useState } from "react";
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
  if (settings && JSON.stringify(settings.colors) !== JSON.stringify(localColors)) {
    setLocalColors(settings.colors);
  }

  const presetPalettes: Array<{ name: string; colors: [string, string, string] }> = [
    { name: "빨강-파랑-초록", colors: ["#ef4444", "#3b82f6", "#22c55e"] },
    { name: "주황-보라-핑크", colors: ["#f97316", "#a855f7", "#ec4899"] },
    { name: "청록-노랑-주황", colors: ["#06b6d4", "#eab308", "#f97316"] },
    { name: "보라-핑크-빨강", colors: ["#9333ea", "#ec4899", "#ef4444"] },
    { name: "초록-청록-파랑", colors: ["#22c55e", "#06b6d4", "#3b82f6"] },
    { name: "노랑-주황-빨강", colors: ["#eab308", "#f97316", "#ef4444"] },
  ];

  // 색상 이름 → 색상 코드 매핑
  const colorNameMap: Record<string, string> = {
    빨강: "#ef4444",
    빨: "#ef4444",
    빨간색: "#ef4444",
    red: "#ef4444",
    파랑: "#3b82f6",
    파: "#3b82f6",
    파란색: "#3b82f6",
    blue: "#3b82f6",
    초록: "#22c55e",
    초: "#22c55e",
    초록색: "#22c55e",
    green: "#22c55e",
    주황: "#f97316",
    주: "#f97316",
    주황색: "#f97316",
    orange: "#f97316",
    보라: "#a855f7",
    보: "#a855f7",
    보라색: "#a855f7",
    purple: "#a855f7",
    핑크: "#ec4899",
    핑: "#ec4899",
    분홍: "#ec4899",
    pink: "#ec4899",
    노랑: "#eab308",
    노: "#eab308",
    노란색: "#eab308",
    yellow: "#eab308",
    청록: "#06b6d4",
    청: "#06b6d4",
    청록색: "#06b6d4",
    cyan: "#06b6d4",
    검정: "#000000",
    검: "#000000",
    검은색: "#000000",
    black: "#000000",
    흰색: "#ffffff",
    흰: "#ffffff",
    white: "#ffffff",
  };

  // 텍스트 입력 파싱 (예: "빨파빨" → ["#ef4444", "#3b82f6", "#ef4444"])
  const parseColorText = (text: string): [string, string, string] | null => {
    const cleaned = text.trim().replace(/\s+/g, "");
    if (cleaned.length < 2) return null;

    const colors: string[] = [];
    let i = 0;
    while (i < cleaned.length && colors.length < 3) {
      // 2글자 매칭 시도 (빨강, 파랑 등)
      if (i + 2 <= cleaned.length) {
        const twoChar = cleaned.slice(i, i + 2);
        if (colorNameMap[twoChar]) {
          colors.push(colorNameMap[twoChar]);
          i += 2;
          continue;
        }
      }
      // 1글자 매칭 시도 (빨, 파, 초 등)
      const oneChar = cleaned[i];
      if (colorNameMap[oneChar]) {
        colors.push(colorNameMap[oneChar]);
        i += 1;
      } else {
        // 매칭 실패 시 다음 문자로
        i += 1;
      }
    }

    if (colors.length === 0) return null;
    // 3개 미만이면 마지막 색상으로 채움
    while (colors.length < 3) {
      colors.push(colors[colors.length - 1] || "#ef4444");
    }
    return [colors[0], colors[1], colors[2]] as [string, string, string];
  };

  const [colorTextInput, setColorTextInput] = useState("");

  const handleColorChange = (index: number, color: string) => {
    const newColors: [string, string, string] = [...localColors] as [string, string, string];
    newColors[index] = color;
    setLocalColors(newColors);
    setColorTextInput(""); // 수동 변경 시 텍스트 입력 초기화
  };

  const handlePresetSelect = (colors: [string, string, string]) => {
    setLocalColors(colors);
    setColorTextInput(""); // 프리셋 선택 시 텍스트 입력 초기화
  };

  const handleColorTextInput = (text: string) => {
    setColorTextInput(text);
    const parsed = parseColorText(text);
    if (parsed) {
      setLocalColors(parsed);
    }
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
          {/* 빠른 텍스트 입력 (예: "빨파빨", "빨강파랑초록") */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--text-muted)]">빠른 색상 입력</div>
            <div className="text-[11px] text-[var(--text-muted)] mb-1">
              예: "빨파빨", "빨강파랑초록", "빨 파 초" (띄어쓰기 무관)
            </div>
            <input
              type="text"
              value={colorTextInput}
              onChange={(e) => handleColorTextInput(e.target.value)}
              placeholder="빨파빨"
              className="w-full h-10 px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] text-sm"
            />
            <div className="text-[10px] text-[var(--text-muted)]">
              지원 색상: 빨강(빨), 파랑(파), 초록(초), 주황(주), 보라(보), 핑크(핑), 노랑(노), 청록(청), 검정(검), 흰색(흰)
            </div>
          </div>

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

        {/* 색상 3개 선택 */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-[var(--text-muted)]">색상 선택 (3개)</div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="space-y-1.5">
                <label className="text-[11px] text-[var(--text-muted)]">
                  색상 {index + 1}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColors[index]}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    className="w-full h-10 rounded-lg border border-[var(--border-divider)] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColors[index]}
                    onChange={(e) => {
                      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                        handleColorChange(index, e.target.value);
                      }
                    }}
                    className="w-20 h-10 px-2 text-xs rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] font-mono"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
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
    </>
  );
}
