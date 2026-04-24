// PATH: src/app_teacher/domains/settings/pages/OrganizationSettingsPage.tsx
// 학원 정보 — 조회/수정 (owner 전용 권장, RoleGuard는 라우터에서)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { Card, SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { Plus, Trash2 } from "@teacher/shared/ui/Icons";
import {
  fetchTenantInfo,
  updateTenantInfo,
  type AcademyEntry,
} from "@admin/domains/profile/api/profile.api";

export default function OrganizationSettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-tenant-info"],
    queryFn: fetchTenantInfo,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [headquartersPhone, setHeadquartersPhone] = useState("");
  const [academies, setAcademies] = useState<AcademyEntry[]>([]);

  useEffect(() => {
    if (data) {
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setHeadquartersPhone(data.headquarters_phone ?? "");
      setAcademies(data.academies ?? []);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (payload: Parameters<typeof updateTenantInfo>[0]) => updateTenantInfo(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-tenant-info"] });
      teacherToast.success("저장됨");
    },
    onError: () => teacherToast.error("저장에 실패했습니다."),
  });

  const addAcademy = () => setAcademies([...academies, { name: "", phone: "" }]);
  const removeAcademy = (i: number) => setAcademies(academies.filter((_, idx) => idx !== i));
  const updateAcademy = (i: number, patch: Partial<AcademyEntry>) => {
    setAcademies(academies.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>학원 정보</h1>
      </div>

      {isLoading && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}

      {data && (
        <>
          <SectionTitle>대표 정보</SectionTitle>
          <Card>
            <div className="flex flex-col gap-2">
              <Field label="이름">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm"
                  style={fieldStyle}
                />
              </Field>
              <Field label="대표 전화">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-sm"
                  style={fieldStyle}
                />
              </Field>
              <Field label="본부 전화 (선택)">
                <input
                  type="tel"
                  value={headquartersPhone}
                  onChange={(e) => setHeadquartersPhone(e.target.value)}
                  className="w-full text-sm"
                  style={fieldStyle}
                />
              </Field>
            </div>
          </Card>

          <SectionTitle
            right={
              <button
                onClick={addAcademy}
                className="flex items-center gap-1 text-[12px] font-semibold cursor-pointer"
                style={{
                  padding: "8px 12px",
                  minHeight: "var(--tc-touch-min)",
                  borderRadius: "var(--tc-radius-sm)",
                  border: "1px solid var(--tc-primary)",
                  background: "var(--tc-primary-bg)",
                  color: "var(--tc-primary)",
                }}
              >
                <Plus size={12} /> 학원 추가
              </button>
            }
          >
            소속 학원 ({academies.length})
          </SectionTitle>

          {academies.length === 0 ? (
            <EmptyState scope="panel" tone="empty" title="등록된 학원이 없습니다" />
          ) : (
            <div className="flex flex-col gap-2">
              {academies.map((a, i) => (
                <Card key={i}>
                  <div className="flex flex-col gap-2">
                    <Field label={`학원 ${i + 1} 이름`}>
                      <input
                        type="text"
                        value={a.name}
                        onChange={(e) => updateAcademy(i, { name: e.target.value })}
                        className="w-full text-sm"
                        style={fieldStyle}
                      />
                    </Field>
                    <Field label="전화">
                      <input
                        type="tel"
                        value={a.phone}
                        onChange={(e) => updateAcademy(i, { phone: e.target.value })}
                        className="w-full text-sm"
                        style={fieldStyle}
                      />
                    </Field>
                    <button
                      onClick={() => removeAcademy(i)}
                      className="flex items-center justify-center gap-1 text-[12px] font-semibold cursor-pointer"
                      style={{
                        padding: "8px",
                        minHeight: "var(--tc-touch-min)",
                        borderRadius: "var(--tc-radius-sm)",
                        border: "1px solid var(--tc-border)",
                        background: "var(--tc-surface)",
                        color: "var(--tc-danger)",
                      }}
                    >
                      <Trash2 size={12} /> 제거
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <SectionTitle>OG 미리보기 (카카오/SNS)</SectionTitle>
          <Card>
            <div className="flex flex-col gap-2">
              <Field label="제목 (선택)">
                <input
                  type="text"
                  value={data.og_title ?? ""}
                  onChange={(e) => qc.setQueryData(["teacher-tenant-info"], { ...data, og_title: e.target.value })}
                  className="w-full text-sm"
                  style={fieldStyle}
                />
              </Field>
              <Field label="설명 (선택)">
                <input
                  type="text"
                  value={data.og_description ?? ""}
                  onChange={(e) =>
                    qc.setQueryData(["teacher-tenant-info"], { ...data, og_description: e.target.value })
                  }
                  className="w-full text-sm"
                  style={fieldStyle}
                />
              </Field>
              <Field label="이미지 URL (선택)">
                <input
                  type="url"
                  value={data.og_image_url ?? ""}
                  onChange={(e) =>
                    qc.setQueryData(["teacher-tenant-info"], { ...data, og_image_url: e.target.value })
                  }
                  className="w-full text-sm"
                  style={fieldStyle}
                />
              </Field>
            </div>
          </Card>

          <button
            onClick={() =>
              saveMut.mutate({
                name: name.trim(),
                phone: phone.trim(),
                headquarters_phone: headquartersPhone.trim(),
                academies: academies.map((a) => ({ name: a.name.trim(), phone: a.phone.trim() })),
                og_title: data.og_title,
                og_description: data.og_description,
                og_image_url: data.og_image_url,
              })
            }
            disabled={saveMut.isPending}
            className="text-sm font-bold cursor-pointer w-full mt-2 disabled:opacity-50"
            style={{
              padding: "14px",
              minHeight: "var(--tc-touch-min)",
              borderRadius: "var(--tc-radius)",
              border: "none",
              background: "var(--tc-primary)",
              color: "#fff",
            }}
          >
            {saveMut.isPending ? "저장 중…" : "저장"}
          </button>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: "10px 12px",
  minHeight: "var(--tc-touch-min)",
  borderRadius: "var(--tc-radius-sm)",
  border: "1px solid var(--tc-border-strong)",
  background: "var(--tc-surface)",
  color: "var(--tc-text)",
  outline: "none",
};
