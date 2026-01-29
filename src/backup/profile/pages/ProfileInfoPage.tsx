// PATH: src/features/profile/pages/ProfileInfoPage.tsx
import { useState } from "react";
import { PageSection } from "@/shared/ui/page";
import useAuth from "@/features/auth/hooks/useAuth";

import ProfileCard from "../components/ProfileCard";
import ChangePasswordModal from "../components/ChangePasswordModal";

export default function ProfileInfoPage() {
  const { clearAuth } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <>
      <PageSection
        title="계정 정보"
        description="현재 로그인한 계정의 기본 정보를 확인합니다."
        right={
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={() => setPwOpen(true)}
            >
              비밀번호 변경
            </button>
            <button
              className="btn-danger text-sm"
              onClick={clearAuth}
            >
              로그아웃
            </button>
          </div>
        }
      >
        <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-6">
          <ProfileCard />
        </div>
      </PageSection>

      <ChangePasswordModal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
      />
    </>
  );
}
