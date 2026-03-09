// PATH: src/features/settings/pages/OrganizationSettingsPage.tsx
// 설정 > 학원 정보 — 섹션형, 여러 학원 등록/추가/수정/제거 (owner 전용)

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCheck, FiX, FiLock, FiPlus, FiTrash2 } from "react-icons/fi";

import {
  fetchTenantInfo,
  updateTenantInfo,
  type AcademyEntry,
} from "@/features/profile/api/profile.api";
import { fetchMe } from "@/features/profile/api/profile.api";
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
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
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
    </div>
  );
}
