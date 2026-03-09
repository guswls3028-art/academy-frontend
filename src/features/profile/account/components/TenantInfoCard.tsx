// PATH: src/features/profile/account/components/TenantInfoCard.tsx
// 설정 > 내 정보 — 소속 학원(본부 전화). 학생앱 "본부 진입게이트"에 노출되는 정보.

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaBuilding } from "react-icons/fa";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTenantInfo, updateTenantInfo } from "../../api/profile.api";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function TenantInfoCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: info, isLoading } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: fetchTenantInfo,
  });
  const updateMut = useMutation({
    mutationFn: updateTenantInfo,
    onSuccess: (data) => {
      qc.setQueryData(["tenant-info"], data);
      feedback.success("저장되었습니다.");
    },
    onError: () => feedback.error("저장에 실패했습니다."),
  });

  const [headquartersPhone, setHeadquartersPhone] = useState("");
  useEffect(() => {
    setHeadquartersPhone(info?.headquarters_phone ?? "");
  }, [info?.headquarters_phone]);

  const handleSave = () => {
    updateMut.mutate({ headquarters_phone: headquartersPhone.trim() });
  };

  if (isLoading || !info) {
    return (
      <div className="ds-card-modal ds-card-modal--narrow">
        <div className="ds-card-modal__body" style={{ padding: "var(--space-4)" }}>
          <span className="text-sm text-[var(--color-text-muted)]">불러오는 중…</span>
        </div>
      </div>
    );
  }

  const displayPhone = info.headquarters_phone || info.phone || "";

  return (
    <div className="ds-card-modal ds-card-modal--narrow">
      <header className="ds-card-modal__header">
        <div aria-hidden className="ds-card-modal__accent" />
        <div className="ds-card-modal__header-inner">
          <div
            className="ds-card-modal__header-icon"
            style={{ color: "var(--color-brand-primary)" }}
            aria-hidden
          >
            <FaBuilding size={16} />
          </div>
          <div className="ds-card-modal__header-text">
            <div className="ds-card-modal__header-title">소속 학원</div>
            <div className="ds-card-modal__header-description">
              학생앱 홈 하단 "본부"에 표시되는 학원명·전화번호입니다. 메시지 연동은{" "}
              <Link to="/admin/settings/messages" className="ds-link">
                메시지 설정
              </Link>
              에서 할 수 있습니다.
            </div>
          </div>
        </div>
      </header>

      <div className="ds-card-modal__body">
        <div className="space-y-2">
          <div>
            <span className="text-xs text-[var(--color-text-muted)]">학원명</span>
            <div className="font-medium text-[var(--color-text-primary)]">{info.name || "—"}</div>
          </div>
          {canEdit ? (
            <div>
              <label className="text-xs text-[var(--color-text-muted)]">본부 전화번호</label>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <input
                  type="tel"
                  className="ds-input"
                  placeholder="예: 02-1234-5678"
                  value={headquartersPhone}
                  onChange={(e) => setHeadquartersPhone(e.target.value)}
                  disabled={updateMut.isPending}
                  style={{ maxWidth: 200 }}
                  aria-label="본부 전화번호"
                />
                <Button
                  type="button"
                  intent="primary"
                  size="md"
                  onClick={handleSave}
                  disabled={updateMut.isPending}
                >
                  {updateMut.isPending ? "저장 중…" : "저장"}
                </Button>
              </div>
            </div>
          ) : (
            displayPhone && (
              <div>
                <span className="text-xs text-[var(--color-text-muted)]">본부 전화</span>
                <div className="font-medium">
                  <a href={`tel:${displayPhone.replace(/\D/g, "")}`} className="ds-link">
                    {displayPhone}
                  </a>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
