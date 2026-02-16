// PATH: src/admin_app/components/AdminOwnerBottomSheet.tsx
// Owner 등록 — Bottom Sheet (위로 슬라이드), 터치 최적화

import { useState } from "react";
import { registerTenantOwner } from "@/admin_app/api/tenants";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: number;
  tenantName: string;
  onSuccess?: (message?: string) => void;
};

export default function AdminOwnerBottomSheet({ open, onClose, tenantId, tenantName, onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError("사용자명을 입력하세요."); return; }
    if (!password) { setError("비밀번호를 입력하세요."); return; }
    setError(null);
    setLoading(true);
    try {
      await registerTenantOwner(tenantId, { username: username.trim(), password, name: name || undefined, phone: phone || undefined });
      const msg = `✓ ${username.trim()} 등록됨`;
      setUsername("");
      setPassword("");
      setName("");
      setPhone("");
      onSuccess?.(msg);
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden />
      <div className="fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col pb-8">
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Owner 등록</h2>
          <button type="button" onClick={onClose} className="p-2 -m-2 rounded-lg text-slate-500 min-w-[48px] min-h-[48px] flex items-center justify-center" aria-label="닫기">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
          <p className="text-sm text-slate-600">{tenantName}</p>
          {error && <div className="p-3 rounded-xl bg-red-50 text-red-800 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">사용자명 *</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="ds-input w-full py-3 rounded-xl min-h-[48px] text-base" placeholder="예: admin97" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">비밀번호 *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ds-input w-full py-3 rounded-xl min-h-[48px] text-base" placeholder="비밀번호" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">이름</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="ds-input w-full py-3 rounded-xl min-h-[48px] text-base" placeholder="예: 홍길동" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">전화번호</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="ds-input w-full py-3 rounded-xl min-h-[48px] text-base" placeholder="예: 01012345678" />
          </div>
          <button type="submit" disabled={loading} className="w-full ds-button min-h-[48px] rounded-xl" data-intent="primary" data-size="md">
            {loading ? "등록 중…" : "등록"}
          </button>
        </form>
      </div>
    </>
  );
}
