// PATH: src/student/domains/profile/pages/ProfilePage.tsx
// 학생이 본인 프로필 사진만 업로드 (관리자 편집 불가)

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchMyProfile, updateMyProfilePhoto } from "../api/profile";
import EmptyState from "@/student/shared/ui/layout/EmptyState";

export default function ProfilePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => updateMyProfilePhoto(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", "me"] });
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadMutation.mutate(file);
    }
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <StudentPageShell title="내 정보">
        <div className="stu-muted">불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (isError || !profile) {
    return (
      <StudentPageShell title="내 정보">
        <EmptyState
          title="프로필을 불러오지 못했습니다."
          description="잠시 후 다시 시도해주세요."
        />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="내 정보" description="프로필 사진과 이름이 헤더에 표시됩니다.">
      <div className="stu-section stu-section--nested">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--stu-space-6)",
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
              overflow: "hidden",
              background: "var(--stu-surface-soft)",
              border: "2px solid var(--stu-border)",
              display: "grid",
              placeItems: "center",
              fontSize: 36,
              fontWeight: 800,
              color: "var(--stu-primary)",
            }}
          >
            {profile.profile_photo_url ? (
              <img
                src={profile.profile_photo_url}
                alt="프로필"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (profile.name || "?")[0]
            )}
          </div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{profile.name}</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: "none" }}
            aria-label="프로필 사진 선택"
          />
          <button
            type="button"
            className="stu-btn stu-btn--primary stu-btn--sm"
            disabled={uploadMutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {uploadMutation.isPending ? "업로드 중…" : "사진 변경"}
          </button>
          {uploadMutation.isError && (
            <div className="stu-muted" style={{ fontSize: 13 }}>
              업로드에 실패했습니다. 이미지 파일만 선택해 주세요.
            </div>
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}
