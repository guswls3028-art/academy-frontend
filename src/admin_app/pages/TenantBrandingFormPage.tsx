// PATH: src/admin_app/pages/TenantBrandingFormPage.tsx
// STEP 3: Branding 전용 화면 — 로고 카드, 24px 간격, Sticky Save Bar, Dirty state

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getTenantBranding as getTenantBrandingApi,
  uploadTenantLogo,
  patchTenantBranding,
} from "@/admin_app/api/branding";
import { getTenants } from "@/admin_app/api/tenants";
import { getTenantBranding, getTenantIdFromCode } from "@/shared/tenant/config";
import StickySaveBar from "@/admin_app/components/StickySaveBar";
import AdminToast from "@/admin_app/components/AdminToast";
import "@/styles/design-system/index.css";
import "@/styles/design-system/ds/input.css";

export default function TenantBrandingFormPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const id = tenantId ? parseInt(tenantId, 10) : NaN;

  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [windowTitle, setWindowTitle] = useState("");
  const [loginTitle, setLoginTitle] = useState("");
  const [loginSubtitle, setLoginSubtitle] = useState("");

  const [initial, setInitial] = useState<{ displayName: string; windowTitle: string; loginTitle: string; loginSubtitle: string } | null>(null);

  const dirty =
    initial != null &&
    (displayName !== initial.displayName ||
      windowTitle !== initial.windowTitle ||
      loginTitle !== initial.loginTitle ||
      loginSubtitle !== initial.loginSubtitle);

  useEffect(() => {
    if (!tenantId || isNaN(id)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([getTenants(), getTenantBrandingApi(id)])
      .then(([list, branding]) => {
        if (cancelled) return;
        const t = list.find((x) => x.id === id);
        if (t) setTenantName(t.name);
        const code = t?.code;
        const logicalId = code ? getTenantIdFromCode(code) : null;
        const fallback = logicalId != null ? getTenantBranding(logicalId) : undefined;
        const d = branding?.displayName ?? fallback?.displayName ?? t?.name ?? "";
        const w = branding?.windowTitle ?? "";
        const lt = branding?.loginTitle ?? fallback?.loginTitle ?? "";
        const ls = branding?.loginSubtitle ?? fallback?.loginSubtitle ?? "";
        setLogoUrl(branding?.logoUrl ?? fallback?.logoUrl ?? null);
        setDisplayName(d);
        setWindowTitle(w);
        setLoginTitle(lt);
        setLoginSubtitle(ls);
        setInitial({ displayName: d, windowTitle: w, loginTitle: lt, loginSubtitle: ls });
      })
      .catch(() => { if (!cancelled) setToast({ message: "로딩 실패", kind: "error" }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, id]);

  const handleLogoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) {
        setToast({ message: "이미지 파일만 선택하세요.", kind: "error" });
        return;
      }
      setUploading(true);
      setToast(null);
      uploadTenantLogo(id, file)
        .then((res) => {
          setLogoUrl(res.logoUrl);
          setToast({ message: "로고 저장됨", kind: "success" });
        })
        .catch(() => setToast({ message: "업로드 실패", kind: "error" }))
        .finally(() => setUploading(false));
      e.target.value = "";
    },
    [id]
  );

  const handleSave = useCallback(() => {
    if (!dirty || isNaN(id)) return;
    setSaving(true);
    setToast(null);
    patchTenantBranding(id, { displayName, windowTitle, loginTitle, loginSubtitle })
      .then(() => {
        setInitial({ displayName, windowTitle, loginTitle, loginSubtitle });
        setToast("저장 완료");
        setTimeout(() => setToast(null), 3000);
      })
      .catch(() => setToast("저장 실패"))
      .finally(() => setSaving(false));
  }, [id, dirty, displayName, windowTitle, loginTitle, loginSubtitle]);

  const handleDiscard = useCallback(() => {
    if (initial) {
      setDisplayName(initial.displayName);
      setWindowTitle(initial.windowTitle);
      setLoginTitle(initial.loginTitle);
      setLoginSubtitle(initial.loginSubtitle);
    }
  }, [initial]);

  if (loading || isNaN(id)) {
    return (
      <div className="pb-24 flex items-center justify-center min-h-[40vh]">
        <div className="text-slate-500">{loading ? "로딩 중..." : "잘못된 테넌트입니다."}</div>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="mb-6">
        <button type="button" onClick={() => navigate(`/dev/branding/${id}`)} className="text-sm text-slate-600 mb-2 flex items-center gap-1">
          ← 설정
        </button>
        <h1 className="text-xl font-bold text-slate-900">브랜딩</h1>
        <p className="text-sm text-slate-500">{tenantName}</p>
      </div>

      {toast && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm border border-emerald-200">
          {toast}
        </div>
      )}

      <section className="mb-6">
        <div className="text-sm font-semibold text-slate-900 mb-2">로고</div>
        <label className="relative block rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 overflow-hidden min-h-[140px] flex flex-col items-center justify-center cursor-pointer active:bg-slate-100">
          <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          {logoUrl ? (
            <>
              <img src={logoUrl} alt="로고" className="max-h-32 w-auto object-contain p-4" />
              <span className="text-slate-500 text-xs pb-2">탭하여 변경</span>
            </>
          ) : (
            <span className="text-slate-500 text-sm py-8">탭하여 로고 선택</span>
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-slate-700 text-sm">업로드 중…</span>
          )}
        </label>
        <p className="text-xs text-slate-500 mt-1">탭하여 로고 이미지 선택</p>
      </section>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">표시 이름 (헤더) *</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="ds-input w-full py-3 rounded-xl min-h-[48px] text-base"
            placeholder="예: 박철 과학"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">브라우저 타이틀</label>
          <input
            type="text"
            value={windowTitle}
            onChange={(e) => setWindowTitle(e.target.value)}
            className="ds-input w-full py-3 rounded-xl min-h-[48px] text-base"
            placeholder="비워두면 표시 이름 사용"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">로그인 타이틀</label>
          <input
            type="text"
            value={loginTitle}
            onChange={(e) => setLoginTitle(e.target.value)}
            className="ds-input w-full py-3 rounded-xl min-h-[48px] text-base"
            placeholder="로그인 화면 상단 문구"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">로그인 서브타이틀</label>
          <input
            type="text"
            value={loginSubtitle}
            onChange={(e) => setLoginSubtitle(e.target.value)}
            className="ds-input w-full py-3 rounded-xl min-h-[48px] text-base"
            placeholder="로그인 화면 하단 문구"
          />
        </div>
      </div>

      <StickySaveBar visible={dirty} onDiscard={handleDiscard} onSave={handleSave} saving={saving} />
    </div>
  );
}
