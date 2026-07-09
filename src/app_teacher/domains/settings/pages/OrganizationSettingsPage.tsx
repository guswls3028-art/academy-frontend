// PATH: src/app_teacher/domains/settings/pages/OrganizationSettingsPage.tsx
// 학원 정보 — 조회/수정 (owner 전용 권장, RoleGuard는 라우터에서)
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { Card, SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { Plus, Trash2 } from "@teacher/shared/ui/Icons";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { teacherSharedQueryKeys } from "@teacher/shared/api/queryKeys";
import {
  fetchTenantInfo,
  updateTenantInfo,
  type AcademyEntry,
} from "@/shared/api/contracts/tenantInfo";
import styles from "./OrganizationSettingsPage.module.css";

export default function OrganizationSettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: teacherSharedQueryKeys.tenantInfo,
    queryFn: fetchTenantInfo,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [headquartersPhone, setHeadquartersPhone] = useState("");
  const [academies, setAcademies] = useState<AcademyEntry[]>([]);
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");

  useEffect(() => {
    if (data) {
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setHeadquartersPhone(data.headquarters_phone ?? "");
      setAcademies(data.academies ?? []);
      setOgTitle(data.og_title ?? "");
      setOgDescription(data.og_description ?? "");
      setOgImageUrl(data.og_image_url ?? "");
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (payload: Parameters<typeof updateTenantInfo>[0]) => updateTenantInfo(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherSharedQueryKeys.tenantInfo });
      teacherToast.success("저장됨");
    },
    onError: () => teacherToast.error("저장에 실패했습니다."),
  });

  const addAcademy = () => setAcademies([...academies, { name: "", phone: "" }]);
  const removeAcademy = (i: number) => setAcademies(academies.filter((_, idx) => idx !== i));
  const updateAcademy = (i: number, patch: Partial<AcademyEntry>) => {
    setAcademies(academies.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };
  const saveSettings = () => {
    saveMut.mutate({
      name: name.trim(),
      phone: phone.trim(),
      headquarters_phone: headquartersPhone.trim(),
      academies: academies.map((a) => ({ name: a.name.trim(), phone: a.phone.trim() })),
      og_title: ogTitle.trim(),
      og_description: ogDescription.trim(),
      og_image_url: ogImageUrl.trim(),
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <BackButton onClick={() => navigate(-1)} />
        <h1 className={styles.title}>학원 정보</h1>
      </div>

      {isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}

      {data && (
        <>
          <SectionTitle>대표 정보</SectionTitle>
          <Card>
            <div className={styles.formStack}>
              <Field label="이름">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.fieldInput}
                />
              </Field>
              <Field label="대표 전화">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={styles.fieldInput}
                />
              </Field>
              <Field label="본부 전화 (선택)">
                <input
                  type="tel"
                  value={headquartersPhone}
                  onChange={(e) => setHeadquartersPhone(e.target.value)}
                  className={styles.fieldInput}
                />
              </Field>
            </div>
          </Card>

          <SectionTitle
            right={
              <button
                type="button"
                onClick={addAcademy}
                className={styles.addButton}
              >
                <Plus size={ICON.xs} /> 학원 추가
              </button>
            }
          >
            소속 학원 ({academies.length})
          </SectionTitle>

          {academies.length === 0 ? (
            <EmptyState
              scope="panel"
              tone="empty"
              title="등록된 학원이 없습니다"
              description="지점 또는 캠퍼스가 있으면 추가해 학원 정보에 함께 노출하세요."
              actions={
                <EmptyActionButton onClick={addAcademy}>
                  학원 추가
                </EmptyActionButton>
              }
            />
          ) : (
            <div className={styles.academyList}>
              {academies.map((a, i) => (
                <Card key={i}>
                  <div className={styles.formStack}>
                    <Field label={`학원 ${i + 1} 이름`}>
                      <input
                        type="text"
                        value={a.name}
                        onChange={(e) => updateAcademy(i, { name: e.target.value })}
                        className={styles.fieldInput}
                      />
                    </Field>
                    <Field label="전화">
                      <input
                        type="tel"
                        value={a.phone}
                        onChange={(e) => updateAcademy(i, { phone: e.target.value })}
                        className={styles.fieldInput}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => removeAcademy(i)}
                      className={styles.removeButton}
                    >
                      <Trash2 size={ICON.xs} /> 제거
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <SectionTitle>OG 미리보기 (카카오/SNS)</SectionTitle>
          <Card>
            <div className={styles.formStack}>
              <Field label="제목 (선택)">
                <input
                  type="text"
                  value={ogTitle}
                  onChange={(e) => setOgTitle(e.target.value)}
                  className={styles.fieldInput}
                />
              </Field>
              <Field label="설명 (선택)">
                <input
                  type="text"
                  value={ogDescription}
                  onChange={(e) => setOgDescription(e.target.value)}
                  className={styles.fieldInput}
                />
              </Field>
              <Field label="이미지 URL (선택)">
                <input
                  type="url"
                  value={ogImageUrl}
                  onChange={(e) => setOgImageUrl(e.target.value)}
                  className={styles.fieldInput}
                />
              </Field>
            </div>
          </Card>

          <button
            type="button"
            onClick={saveSettings}
            disabled={saveMut.isPending}
            className={styles.saveButton}
          >
            {saveMut.isPending ? "저장 중…" : "저장"}
          </button>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}
      </label>
      {children}
    </div>
  );
}
