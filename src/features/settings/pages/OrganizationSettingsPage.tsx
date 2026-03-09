// PATH: src/features/settings/pages/OrganizationSettingsPage.tsx
// 설정 > 학원 정보 — 학원명·전화번호 인라인 편집 (owner 전용)

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCheck, FiX, FiLock } from "react-icons/fi";

import {
  fetchTenantInfo,
  updateTenantInfo,
} from "@/features/profile/api/profile.api";
import { fetchMe } from "@/features/profile/api/profile.api";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

import s from "../components/SettingsSection.module.css";

function OrgEditGroup({
  initialName,
  initialPhone,
  onSave,
  onCancel,
  saving,
}: {
  initialName: string;
  initialPhone: string;
  onSave: (name: string, phone: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);

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
        </div>
      </div>
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const meQ = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const isOwner = meQ.data?.tenantRole === "owner" || meQ.data?.is_superuser;

  const tenantQ = useQuery({
    queryKey: ["tenant-info"],
    queryFn: fetchTenantInfo,
    enabled: !!isOwner,
  });

  const updateMut = useMutation({
    mutationFn: (payload: { name: string; headquarters_phone: string }) =>
      updateTenantInfo(payload),
    onSuccess: (data) => {
      qc.setQueryData(["tenant-info"], data);
      feedback.success("저장되었습니다.");
      setEditing(false);
    },
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  // Init local state
  const [localPhone, setLocalPhone] = useState("");
  useEffect(() => {
    if (tenantQ.data) setLocalPhone(tenantQ.data.headquarters_phone || tenantQ.data.phone || "");
  }, [tenantQ.data]);

  if (meQ.isLoading) {
    return (
      <div className={s.page}>
        <div className={s.loadingBox}>불러오는 중…</div>
      </div>
    );
  }

  // Non-owner: show read-only message
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
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                학원 정보는 대표 계정에서만 수정할 수 있습니다.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const info = tenantQ.data;
  const displayPhone = info ? (info.headquarters_phone || info.phone || "") : "";

  return (
    <div className={s.page}>
      <div className={s.sectionHeader}>
        <h2 className={s.sectionTitle}>학원 정보</h2>
        <p className={s.sectionDescription}>
          학원명과 전화번호는 학생 앱 홈의 "학원문의"에 표시됩니다.
        </p>
      </div>

      <section className={s.section}>
        {tenantQ.isLoading ? (
          <div className={s.loadingBox}>불러오는 중…</div>
        ) : (
          <div className={s.rows}>
            {editing ? (
              <OrgEditGroup
                initialName={info?.name ?? ""}
                initialPhone={displayPhone}
                onSave={async (name, phone) => {
                  await updateMut.mutateAsync({
                    name,
                    headquarters_phone: phone,
                  });
                }}
                onCancel={() => setEditing(false)}
                saving={updateMut.isPending}
              />
            ) : (
              <>
                <div className={s.row}>
                  <span className={s.rowLabel}>학원명</span>
                  <span className={info?.name ? s.rowValue : s.rowValueMuted}>
                    {info?.name || "미설정"}
                  </span>
                  <div className={s.rowActions}>
                    <button
                      className={s.editBtn}
                      onClick={() => setEditing(true)}
                      type="button"
                    >
                      수정
                    </button>
                  </div>
                </div>
                <div className={s.row}>
                  <span className={s.rowLabel}>학원문의 전화</span>
                  <span className={displayPhone ? s.rowValue : s.rowValueMuted}>
                    {displayPhone || "미설정"}
                  </span>
                  <div className={s.rowActions}>
                    <button
                      className={s.editBtn}
                      onClick={() => setEditing(true)}
                      type="button"
                    >
                      수정
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
