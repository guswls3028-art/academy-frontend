// PATH: src/dev_app/features/tenants/TenantListPanel.tsx
// 좌측 테넌트 리스트: 검색 + 선택

import { useState, useMemo } from "react";
import type { TenantDto } from "@/dev_app/api/tenants";

type Props = {
  tenants: TenantDto[];
  selectedId: number | null;
  onSelect: (tenant: TenantDto) => void;
  loading: boolean;
  onCreateClick: () => void;
  showCreateForm: boolean;
};

export default function TenantListPanel({
  tenants,
  selectedId,
  onSelect,
  loading,
  onCreateClick,
  showCreateForm,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.trim().toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.primaryDomain && t.primaryDomain.toLowerCase().includes(q))
    );
  }, [tenants, search]);

  return (
    <div className="admin-tenant-list-panel flex flex-col h-full min-h-0 bg-white border-r border-slate-200 md:rounded-l-lg">
      <div className="shrink-0 p-3 border-b border-slate-200 space-y-2">
        <input
          type="search"
          placeholder="테넌트 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ds-input w-full text-sm"
          aria-label="테넌트 검색"
        />
        <button
          type="button"
          onClick={onCreateClick}
          className="ds-button w-full justify-center"
          data-intent={showCreateForm ? "secondary" : "primary"}
          data-size="md"
        >
          {showCreateForm ? "취소" : "+ 새 테넌트"}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-slate-100 animate-pulse"
                aria-hidden
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">
            {search.trim() ? "검색 결과 없음" : "테넌트가 없습니다."}
          </div>
        ) : (
          <ul className="p-2 space-y-0.5" role="list">
            {filtered.map((tenant) => (
              <li key={tenant.id}>
                <button
                  type="button"
                  onClick={() => onSelect(tenant)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    selectedId === tenant.id
                      ? "bg-slate-800 text-white"
                      : "hover:bg-slate-100 text-slate-800"
                  }`}
                >
                  <span className="font-medium truncate">{tenant.name}</span>
                  <span
                    className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${
                      selectedId === tenant.id
                        ? "bg-white/20"
                        : tenant.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {tenant.isActive ? "활성" : "비활성"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
