// PATH: src/dev_app/features/tenants/TenantDetailPanel.tsx
// 우측 워크스페이스: 탭(Overview, Branding, Domains, Owners) + 내용

import { getTenantBranding, getTenantIdFromCode } from "@/shared/tenant/config";
import type { TenantDto, TenantOwnerDto } from "@/dev_app/api/tenants";
import OverviewTab from "./tabs/OverviewTab";
import BrandingTab from "./tabs/BrandingTab";
import DomainsTab from "./tabs/DomainsTab";
import OwnersTab from "./tabs/OwnersTab";

export type TabId = "overview" | "branding" | "domains" | "owners";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "branding", label: "Branding" },
  { id: "domains", label: "Domains" },
  { id: "owners", label: "Owners" },
];

type BrandingState = {
  logoUrls: Record<number, string>;
  loginTitles: Record<number, string>;
  loginSubtitles: Record<number, string>;
  windowTitles: Record<number, string>;
  displayNames: Record<number, string>;
};

type Props = {
  tenant: TenantDto | null;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  branding: BrandingState;
  uploadingLogoId: number | null;
  ownersList: TenantOwnerDto[];
  ownersLoading: boolean;
  onOpenOwnerSheet: () => void;
  onRemoveOwner: (tenantId: number, userId: number) => Promise<void>;
  onUpdateOwner: (tenantId: number, userId: number, payload: { name?: string; phone?: string }) => Promise<void>;
  onLogoUpload: (tenantId: number, file: File) => void;
  onSaveBranding: (tenantId: number) => void;
  onDisplayNameChange: (tenantId: number, value: string) => void;
  onWindowTitleChange: (tenantId: number, value: string) => void;
  onLoginTitleChange: (tenantId: number, value: string) => void;
  onLoginSubtitleChange: (tenantId: number, value: string) => void;
};

export default function TenantDetailPanel({
  tenant,
  activeTab,
  onTabChange,
  branding,
  uploadingLogoId,
  ownersList,
  ownersLoading,
  onOpenOwnerSheet,
  onRemoveOwner,
  onUpdateOwner,
  onLogoUpload,
  onSaveBranding,
  onDisplayNameChange,
  onWindowTitleChange,
  onLoginTitleChange,
  onLoginSubtitleChange,
}: Props) {
  if (!tenant) {
    return (
      <div className="admin-tenant-detail-panel flex flex-col h-full min-h-0 bg-slate-50/50 flex-1 flex items-center justify-center p-8">
        <p className="text-slate-500 text-sm">
          좌측에서 테넌트를 선택하세요.
        </p>
      </div>
    );
  }

  const id = tenant.id;
  const logicalId = getTenantIdFromCode(tenant.code);
  const fallback = logicalId != null ? getTenantBranding(logicalId) : undefined;
  const logoUrl = branding.logoUrls[id] ?? fallback?.logoUrl ?? null;
  const loginTitle = branding.loginTitles[id] ?? fallback?.loginTitle ?? "";
  const loginSubtitle = branding.loginSubtitles[id] ?? fallback?.loginSubtitle ?? "";
  const windowTitle = branding.windowTitles[id] ?? "";
  const displayName = branding.displayNames[id] ?? fallback?.displayName ?? tenant.name;

  return (
    <div className="admin-tenant-detail-panel flex flex-col h-full min-h-0 bg-white border border-slate-200 rounded-lg overflow-hidden flex-1">
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {tenant.name}
          </h2>
          <p className="text-sm text-slate-500">
            {tenant.code} · ID {tenant.id}
            {tenant.primaryDomain && ` · ${tenant.primaryDomain}`}
          </p>
        </div>
        <nav className="flex gap-0 px-2" aria-label="Tenant tabs">
          {TABS.map(({ id: tabId, label }) => (
            <button
              key={tabId}
              type="button"
              onClick={() => onTabChange(tabId)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tabId
                  ? "border-slate-800 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {activeTab === "overview" && <OverviewTab tenant={tenant} />}
        {activeTab === "branding" && (
          <BrandingTab
            tenantId={id}
            tenantName={tenant.name}
            logoUrl={logoUrl}
            displayName={displayName}
            windowTitle={windowTitle}
            loginTitle={loginTitle}
            loginSubtitle={loginSubtitle}
            uploading={uploadingLogoId === id}
            onLogoChange={(file) => onLogoUpload(id, file)}
            onDisplayNameChange={(v) => onDisplayNameChange(id, v)}
            onWindowTitleChange={(v) => onWindowTitleChange(id, v)}
            onLoginTitleChange={(v) => onLoginTitleChange(id, v)}
            onLoginSubtitleChange={(v) => onLoginSubtitleChange(id, v)}
            onSave={() => onSaveBranding(id)}
          />
        )}
        {activeTab === "domains" && <DomainsTab tenant={tenant} />}
        {activeTab === "owners" && (
          <OwnersTab
            tenantId={id}
            tenantName={tenant.name}
            owners={ownersList}
            loading={ownersLoading}
            onAddOwner={onOpenOwnerSheet}
            onRemoveOwner={onRemoveOwner}
            onUpdateOwner={onUpdateOwner}
          />
        )}
      </div>
    </div>
  );
}
