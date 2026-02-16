// PATH: src/admin_app/features/tenants/tabs/OwnersTab.tsx
// Owner 리스트 + 제거/수정 CRUD, + Owner 추가는 부모(BottomSheet)

import { useState } from "react";
import type { TenantOwnerDto } from "@/admin_app/api/tenants";
import "@/styles/design-system/ds/input.css";

type Props = {
  tenantId: number;
  tenantName: string;
  owners: TenantOwnerDto[];
  loading?: boolean;
  onAddOwner: () => void;
  onRemoveOwner: (tenantId: number, userId: number) => Promise<void>;
  onUpdateOwner: (tenantId: number, userId: number, payload: { name?: string; phone?: string }) => Promise<void>;
};

export default function OwnersTab({
  tenantId,
  tenantName,
  owners,
  loading = false,
  onAddOwner,
  onRemoveOwner,
  onUpdateOwner,
}: Props) {
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  const startEdit = (o: TenantOwnerDto) => {
    setEditingUserId(o.userId);
    setEditName(o.name || "");
    setEditPhone(o.phone ?? "");
  };
  const cancelEdit = () => {
    setEditingUserId(null);
    setEditName("");
    setEditPhone("");
  };
  const saveEdit = async () => {
    if (editingUserId == null) return;
    await onUpdateOwner(tenantId, editingUserId, { name: editName || undefined, phone: editPhone || undefined });
    setEditingUserId(null);
    setEditName("");
    setEditPhone("");
  };
  const handleRemove = async (userId: number) => {
    if (!confirm("이 테넌트에서 해당 Owner를 제거합니다. 로그인 권한이 사라집니다. 계속할까요?")) return;
    setRemovingId(userId);
    try {
      await onRemoveOwner(tenantId, userId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
        이 계정은 <strong>{tenantName}</strong> 전용입니다.
        다른 테넌트에서는 로그인할 수 없습니다.
      </div>

      <section className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          👤 Owner 계정 ({owners.length}명)
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : owners.length === 0 ? (
          <>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium mb-3">
              ⚠ Owner 계정이 없습니다.
              <br />
              이 테넌트는 관리자가 로그인할 수 없습니다.
            </div>
            <p className="text-sm text-slate-500 mb-3">등록된 Owner가 없습니다.</p>
          </>
        ) : (
          <ul className="space-y-2 mb-4">
            {owners.map((o) => (
              <li
                key={o.userId}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                {editingUserId === o.userId ? (
                  <>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="font-medium text-slate-900">{o.username}</div>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="이름"
                        className="ds-input w-full py-2 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="전화"
                        className="ds-input w-full py-2 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={saveEdit} className="ds-button text-sm" data-intent="primary" data-size="sm">저장</button>
                      <button type="button" onClick={cancelEdit} className="ds-button text-sm" data-intent="secondary" data-size="sm">취소</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="font-medium text-slate-900">{o.username}</div>
                      <div className="text-xs text-slate-500">{o.name || "이름 없음"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">OWNER</span>
                      <button type="button" onClick={() => startEdit(o)} className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded">수정</button>
                      <button
                        type="button"
                        onClick={() => handleRemove(o.userId)}
                        disabled={removingId === o.userId}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded disabled:opacity-50"
                      >
                        {removingId === o.userId ? "제거 중…" : "제거"}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onAddOwner}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-medium min-h-[48px] hover:bg-slate-50 active:bg-slate-100"
        >
          + Owner 추가
        </button>
      </section>
    </div>
  );
}
