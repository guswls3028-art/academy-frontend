// PATH: src/dev_app/components/AdminOwnerBottomSheet.tsx
// Owner 등록 — 컴팩트 폼 + 버튼 아래 고정 결과 (토스트 대신)

import OwnerFormCompact from "@/dev_app/components/OwnerFormCompact";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: number;
  tenantName: string;
  onSuccess?: () => void;
};

export default function AdminOwnerBottomSheet({ open, onClose, tenantId, tenantName, onSuccess }: Props) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden />
      <div className="fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col pb-8">
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">원장 계정 생성</h2>
          <button type="button" onClick={onClose} className="p-2 -m-2 rounded-lg text-slate-500 min-w-[48px] min-h-[48px] flex items-center justify-center" aria-label="닫기">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <p className="text-sm text-slate-600 mb-4">{tenantName}</p>
          <OwnerFormCompact
            tenantId={tenantId}
            tenantName={tenantName}
            showResultBelow={true}
            onSuccess={() => {
              onSuccess?.();
            }}
          />
        </div>
      </div>
    </>
  );
}
