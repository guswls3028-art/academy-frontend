// PATH: src/features/settings/pages/OrganizationSettingsPage.tsx
// 설정 > 학원 정보 — 섹션형, 여러 학원 등록/추가/수정/제거 (owner 전용)

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCheck, FiX, FiLock, FiPlus, FiTrash2, FiMessageCircle, FiFileText } from "react-icons/fi";

import {
  fetchTenantInfo,
  updateTenantInfo,
  type AcademyEntry,
} from "@/features/profile/api/profile.api";
import { fetchMe } from "@/features/profile/api/profile.api";
import { fetchLegalConfig, updateLegalConfig, type LegalConfig } from "@/features/legal/api/legal.api";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

import s from "../components/SettingsSection.module.css";

function AcademyRow({
  entry,
  onSave,
  onRemove,
  onCancel,
  saving,
}: {
  entry: AcademyEntry;
  onSave: (name: string, phone: string) => Promise<void>;
  onRemove: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(entry.name);
  const [phone, setPhone] = useState(entry.phone);

  useEffect(() => {
    setName(entry.name);
    setPhone(entry.phone);
  }, [entry.name, entry.phone]);

  return (
    <div className={s.rowEdit}>
      <div className={s.rowLabel} style={{ paddingTop: 4 }}>학원 정보</div>
      <div className={s.rowEditRight}>
        <div className={s.rowEditInputs}>
          <div>
            <p className={s.fieldLabel}>학원명</p>
            <input
              type="text"
              className="ds-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: OO학원"
              aria-label="학원명"
              disabled={saving}
              style={{ maxWidth: 280 }}
            />
          </div>
          <div>
            <p className={s.fieldLabel}>학원문의 전화번호</p>
            <input
              type="tel"
              className="ds-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="예: 02-1234-5678"
              aria-label="학원문의 전화번호"
              disabled={saving}
              style={{ maxWidth: 200 }}
            />
          </div>
        </div>
        <div className={s.rowEditActions}>
          <Button
            type="button"
            intent="primary"
            size="sm"
            onClick={() => onSave(name.trim(), phone.trim())}
            disabled={saving}
            loading={saving}
            leftIcon={saving ? undefined : <FiCheck size={13} />}
          >
            {saving ? "저장 중…" : "저장"}
          </Button>
          <Button type="button" intent="ghost" size="sm" onClick={onCancel} disabled={saving} leftIcon={<FiX size={13} />}>
            취소
          </Button>
          <Button
            type="button"
            intent="ghost"
            size="sm"
            onClick={onRemove}
            disabled={saving}
            leftIcon={<FiTrash2 size={13} />}
            className="text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)]"
          >
            제거
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const qc = useQueryClient();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const meQ = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const isOwner = meQ.data?.tenantRole === "owner" || meQ.data?.is_superuser;

  const tenantQ = useQuery({
    queryKey: ["tenant-info"],
    queryFn: fetchTenantInfo,
    enabled: !!isOwner,
  });

  const updateMut = useMutation({
    mutationFn: (payload: { academies: AcademyEntry[] }) =>
      updateTenantInfo({ academies: payload.academies }),
    onSuccess: (data) => {
      qc.setQueryData(["tenant-info"], data);
      feedback.success("저장되었습니다.");
      setEditingIndex(null);
      setAdding(false);
      setNewName("");
      setNewPhone("");
    },
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  const list: AcademyEntry[] = tenantQ.data?.academies?.length
    ? tenantQ.data.academies
    : tenantQ.data
      ? [{ name: tenantQ.data.name || "", phone: tenantQ.data.headquarters_phone || "" }]
      : [];

  const handleSaveEdit = async (index: number, name: string, phone: string) => {
    const next = [...list];
    next[index] = { name, phone };
    await updateMut.mutateAsync({ academies: next });
  };

  const handleRemove = async (index: number) => {
    const next = list.filter((_, i) => i !== index);
    if (next.length === 0) {
      feedback.error("최소 1개 학원은 등록되어 있어야 합니다.");
      return;
    }
    await updateMut.mutateAsync({ academies: next });
  };

  const handleAdd = async () => {
    const name = newName.trim();
    const phone = newPhone.trim();
    if (!name) {
      feedback.error("학원명을 입력하세요.");
      return;
    }
    const next = [...list, { name, phone }];
    await updateMut.mutateAsync({ academies: next });
  };

  if (meQ.isLoading) {
    return (
      <div className={s.page}>
        <div className={s.loadingBox}>불러오는 중…</div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className={s.page}>
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>학원 정보</h2>
          <p className={s.sectionDescription}>학원명, 전화번호 등 학원 기본 정보를 관리합니다.</p>
        </div>
        <div className={s.rows}>
          <div className={s.row} style={{ gridTemplateColumns: "1fr auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FiLock size={14} style={{ color: "var(--color-text-muted)" }} aria-hidden />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-muted)" }}>
                학원 정보는 대표 계정에서만 수정할 수 있습니다.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>학원 정보</h2>
        <p className={s.sectionDescription}>
          소속 학원을 여러 개 등록할 수 있습니다. 학원명과 전화번호는 학생 앱 홈의 「학원문의」에 표시됩니다.
        </p>
      </div>

      <section className={s.section}>
        {tenantQ.isLoading ? (
          <div className={s.loadingBox}>불러오는 중…</div>
        ) : (
          <>
            <div className={s.rows}>
              {list.map((entry, index) => (
                <div key={index}>
                  {editingIndex === index ? (
                    <AcademyRow
                      entry={entry}
                      onSave={(name, phone) => handleSaveEdit(index, name, phone)}
                      onRemove={() => handleRemove(index)}
                      onCancel={() => setEditingIndex(null)}
                      saving={updateMut.isPending}
                    />
                  ) : (
                    <div className={s.row}>
                      <span className={s.rowLabel}>학원 {index + 1}</span>
                      <span className={entry.name ? s.rowValue : s.rowValueMuted}>
                        {entry.name || "미설정"} · {entry.phone || "미설정"}
                      </span>
                      <div className={s.rowActions}>
                        <button
                          className={s.editBtn}
                          onClick={() => setEditingIndex(index)}
                          type="button"
                        >
                          수정
                        </button>
                        {list.length > 1 && (
                          <button
                            type="button"
                            className={s.editBtn}
                            style={{ color: "var(--color-error)" }}
                            onClick={() => handleRemove(index)}
                          >
                            제거
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {adding && (
                <div className={s.rowEdit}>
                  <div className={s.rowLabel} style={{ paddingTop: 4 }}>새 학원</div>
                  <div className={s.rowEditRight}>
                    <div className={s.rowEditInputs}>
                      <div>
                        <p className={s.fieldLabel}>학원명</p>
                        <input
                          type="text"
                          className="ds-input"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="예: OO학원"
                          disabled={updateMut.isPending}
                          style={{ maxWidth: 280 }}
                        />
                      </div>
                      <div>
                        <p className={s.fieldLabel}>학원문의 전화번호</p>
                        <input
                          type="tel"
                          className="ds-input"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="예: 02-1234-5678"
                          disabled={updateMut.isPending}
                          style={{ maxWidth: 200 }}
                        />
                      </div>
                    </div>
                    <div className={s.rowEditActions}>
                      <Button
                        type="button"
                        intent="primary"
                        size="sm"
                        onClick={handleAdd}
                        disabled={updateMut.isPending || !newName.trim()}
                        loading={updateMut.isPending}
                        leftIcon={updateMut.isPending ? undefined : <FiCheck size={13} />}
                      >
                        {updateMut.isPending ? "저장 중…" : "추가"}
                      </Button>
                      <Button
                        type="button"
                        intent="ghost"
                        size="sm"
                        onClick={() => {
                          setAdding(false);
                          setNewName("");
                          setNewPhone("");
                        }}
                        disabled={updateMut.isPending}
                        leftIcon={<FiX size={13} />}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!adding && (
              <div style={{ marginTop: 12 }}>
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={() => setAdding(true)}
                  leftIcon={<FiPlus size={14} />}
                >
                  학원 추가
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── 카카오톡 미리보기 설정 ── */}
      <OgPreviewSection tenantData={tenantQ.data} saving={updateMut.isPending} />

      {/* ── 법적 고지 정보 ── */}
      <LegalInfoSection />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  카카오톡 OG 미리보기 설정 섹션                                       */
/* ------------------------------------------------------------------ */

function OgPreviewSection({
  tenantData,
  saving: parentSaving,
}: {
  tenantData?: { og_title?: string; og_description?: string; og_image_url?: string; name?: string } | null;
  saving: boolean;
}) {
  const qc = useQueryClient();
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (tenantData) {
      setOgTitle(tenantData.og_title || "");
      setOgDescription(tenantData.og_description || "");
      setOgImageUrl(tenantData.og_image_url || "");
    }
  }, [tenantData]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateTenantInfo({
        og_title: ogTitle.trim(),
        og_description: ogDescription.trim(),
        og_image_url: ogImageUrl.trim(),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["tenant-info"], data);
      feedback.success("카카오톡 미리보기가 저장되었습니다. 반영까지 최대 5분 소요됩니다.");
      setEditing(false);
    },
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  const displayTitle = ogTitle || tenantData?.name || "학원명";
  const displayDesc = ogDescription || `${displayTitle} 학습 플랫폼`;
  const isSaving = saveMut.isPending || parentSaving;

  return (
    <>
      <div className={s.sectionHeader} style={{ marginTop: 32 }}>
        <h2 className={s.sectionTitle}>
          <FiMessageCircle size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
          카카오톡 미리보기
        </h2>
        <p className={s.sectionDescription}>
          카카오톡에서 학원 링크를 공유할 때 표시되는 제목, 설명, 이미지를 설정합니다.
        </p>
      </div>

      <section className={s.section}>
        {/* 미리보기 카드 */}
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          {/* 카카오톡 스타일 미리보기 */}
          <div
            style={{
              width: 280,
              border: "1px solid var(--color-border-divider)",
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--color-bg-surface)",
              flexShrink: 0,
            }}
          >
            {ogImageUrl ? (
              <div
                style={{
                  width: "100%",
                  height: 140,
                  background: `url(${ogImageUrl}) center/contain no-repeat var(--color-bg-surface-soft)`,
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 140,
                  background: "var(--color-bg-surface-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-text-muted)",
                  fontSize: 12,
                }}
              >
                이미지 미설정
              </div>
            )}
            <div style={{ padding: "10px 14px 12px" }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  marginBottom: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayTitle}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayDesc}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  marginTop: 4,
                  opacity: 0.7,
                }}
              >
                {location.hostname}
              </div>
            </div>
          </div>

          {/* 입력 폼 */}
          <div style={{ flex: 1, minWidth: 260 }}>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <p className={s.fieldLabel}>제목</p>
                  <input
                    type="text"
                    className="ds-input"
                    value={ogTitle}
                    onChange={(e) => setOgTitle(e.target.value)}
                    placeholder="비워두면 학원명 사용"
                    disabled={isSaving}
                    maxLength={100}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <p className={s.fieldLabel}>설명</p>
                  <input
                    type="text"
                    className="ds-input"
                    value={ogDescription}
                    onChange={(e) => setOgDescription(e.target.value)}
                    placeholder="비워두면 '학원명 학습 플랫폼' 사용"
                    disabled={isSaving}
                    maxLength={300}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <p className={s.fieldLabel}>이미지 URL</p>
                  <input
                    type="text"
                    className="ds-input"
                    value={ogImageUrl}
                    onChange={(e) => setOgImageUrl(e.target.value)}
                    placeholder="/tenants/xxx/logo.png 또는 https://..."
                    disabled={isSaving}
                    maxLength={500}
                    style={{ width: "100%" }}
                  />
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                    /tenants/ 로 시작하면 사이트 내 이미지, https:// 로 시작하면 외부 이미지
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    type="button"
                    intent="primary"
                    size="sm"
                    onClick={() => saveMut.mutate()}
                    disabled={isSaving}
                    loading={saveMut.isPending}
                    leftIcon={saveMut.isPending ? undefined : <FiCheck size={13} />}
                  >
                    저장
                  </Button>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      if (tenantData) {
                        setOgTitle(tenantData.og_title || "");
                        setOgDescription(tenantData.og_description || "");
                        setOgImageUrl(tenantData.og_image_url || "");
                      }
                    }}
                    disabled={isSaving}
                    leftIcon={<FiX size={13} />}
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div className={s.rows}>
                <div className={s.row}>
                  <span className={s.rowLabel}>제목</span>
                  <span className={ogTitle ? s.rowValue : s.rowValueMuted}>
                    {ogTitle || "미설정 (학원명 사용)"}
                  </span>
                </div>
                <div className={s.row}>
                  <span className={s.rowLabel}>설명</span>
                  <span className={ogDescription ? s.rowValue : s.rowValueMuted}>
                    {ogDescription || "미설정 (자동 생성)"}
                  </span>
                </div>
                <div className={s.row}>
                  <span className={s.rowLabel}>이미지</span>
                  <span className={ogImageUrl ? s.rowValue : s.rowValueMuted}>
                    {ogImageUrl || "미설정"}
                  </span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    수정
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}


/* ------------------------------------------------------------------ */
/*  법적 고지 정보 설정 섹션 (이용약관/개인정보처리방침 표시용)              */
/* ------------------------------------------------------------------ */

const LEGAL_FIELDS: { key: keyof Omit<LegalConfig, "terms_version" | "privacy_version" | "effective_date">; label: string; placeholder: string; maxLen: number }[] = [
  { key: "company_name", label: "상호", placeholder: "예: 주식회사 OO교육", maxLen: 200 },
  { key: "representative", label: "대표자명", placeholder: "예: 홍길동", maxLen: 100 },
  { key: "business_number", label: "사업자등록번호", placeholder: "예: 123-45-67890", maxLen: 50 },
  { key: "ecommerce_number", label: "통신판매업 신고번호", placeholder: "예: 제2026-서울강남-0001호", maxLen: 100 },
  { key: "address", label: "사업장 주소", placeholder: "예: 서울특별시 강남구 ...", maxLen: 500 },
  { key: "support_email", label: "고객센터 이메일", placeholder: "예: support@example.com", maxLen: 200 },
  { key: "support_phone", label: "고객센터 전화번호", placeholder: "예: 02-1234-5678", maxLen: 50 },
  { key: "privacy_officer_name", label: "개인정보 보호책임자", placeholder: "예: 홍길동", maxLen: 100 },
  { key: "privacy_officer_contact", label: "보호책임자 연락처", placeholder: "예: privacy@example.com 또는 02-1234-5678", maxLen: 200 },
];

function LegalInfoSection() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const legalQ = useQuery({
    queryKey: ["legal-config"],
    queryFn: fetchLegalConfig,
  });

  useEffect(() => {
    if (legalQ.data) {
      const initial: Record<string, string> = {};
      for (const f of LEGAL_FIELDS) {
        initial[f.key] = (legalQ.data as any)[f.key] || "";
      }
      setForm(initial);
    }
  }, [legalQ.data]);

  const saveMut = useMutation({
    mutationFn: (payload: Partial<LegalConfig>) => updateLegalConfig(payload),
    onSuccess: (data) => {
      qc.setQueryData(["legal-config"], data);
      feedback.success("법적 고지 정보가 저장되었습니다.");
      setEditing(false);
    },
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  const handleSave = () => {
    const payload: Record<string, string> = {};
    for (const f of LEGAL_FIELDS) {
      payload[f.key] = (form[f.key] || "").trim();
    }
    saveMut.mutate(payload as any);
  };

  const handleCancel = () => {
    setEditing(false);
    if (legalQ.data) {
      const initial: Record<string, string> = {};
      for (const f of LEGAL_FIELDS) {
        initial[f.key] = (legalQ.data as any)[f.key] || "";
      }
      setForm(initial);
    }
  };

  const isSaving = saveMut.isPending;

  return (
    <>
      <div className={s.sectionHeader} style={{ marginTop: 32 }}>
        <h2 className={s.sectionTitle}>
          <FiFileText size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
          법적 고지 정보
        </h2>
        <p className={s.sectionDescription}>
          이용약관, 개인정보처리방침 페이지에 표시되는 사업자 정보입니다. 미입력 항목은 &quot;정보 미등록&quot;으로 표시됩니다.
        </p>
      </div>

      <section className={s.section}>
        {legalQ.isLoading ? (
          <div className={s.loadingBox}>불러오는 중...</div>
        ) : editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {LEGAL_FIELDS.map((f) => (
              <div key={f.key}>
                <p className={s.fieldLabel}>{f.label}</p>
                <input
                  type="text"
                  className="ds-input"
                  value={form[f.key] || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  disabled={isSaving}
                  maxLength={f.maxLen}
                  style={{ width: "100%", maxWidth: 480 }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Button
                type="button"
                intent="primary"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                loading={isSaving}
                leftIcon={isSaving ? undefined : <FiCheck size={13} />}
              >
                저장
              </Button>
              <Button
                type="button"
                intent="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
                leftIcon={<FiX size={13} />}
              >
                취소
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={s.rows}>
              {LEGAL_FIELDS.map((f) => (
                <div className={s.row} key={f.key}>
                  <span className={s.rowLabel}>{f.label}</span>
                  <span className={form[f.key] ? s.rowValue : s.rowValueMuted}>
                    {form[f.key] || "미설정"}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <Button
                type="button"
                intent="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                수정
              </Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
