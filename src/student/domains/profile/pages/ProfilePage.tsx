// PATH: src/student/domains/profile/pages/ProfilePage.tsx
// 학생 프로필 정보 표시 및 아이디/비밀번호 변경

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchMyProfile } from "../api/profile";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import api from "@/student/shared/api/studentApi";

export default function ProfilePage() {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const updateUsernameMutation = useMutation({
    mutationFn: async (newUsername: string) => {
      const res = await api.patch("/student/me/", { username: newUsername });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", "me"] });
      setUsername("");
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const res = await api.patch("/student/me/", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return res.data;
    },
    onSuccess: () => {
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
  });

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    updateUsernameMutation.mutate(username.trim());
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !newPassword.trim()) return;
    if (newPassword !== confirmPassword) {
      alert("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    updatePasswordMutation.mutate({
      currentPassword: password,
      newPassword: newPassword,
    });
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
    <StudentPageShell title="내 정보">
      {/* 기본 정보 */}
      <div className="stu-section stu-section--nested" style={{ marginBottom: "var(--stu-space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          <div>
            <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>이름</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.name || "-"}</div>
          </div>
          <div>
            <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>학생 ID</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.id}</div>
          </div>
        </div>
      </div>

      {/* 아이디 변경 */}
      <div className="stu-section stu-section--nested" style={{ marginBottom: "var(--stu-space-6)" }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>아이디 변경</div>
        <form onSubmit={handleUsernameSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="새 아이디"
            className="stu-input"
          />
          <button
            type="submit"
            className="stu-btn stu-btn--primary stu-btn--sm"
            disabled={updateUsernameMutation.isPending || !username.trim()}
          >
            {updateUsernameMutation.isPending ? "변경 중…" : "아이디 변경"}
          </button>
          {updateUsernameMutation.isError && (
            <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-danger)" }}>
              아이디 변경에 실패했습니다.
            </div>
          )}
          {updateUsernameMutation.isSuccess && (
            <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-success)" }}>
              아이디가 변경되었습니다.
            </div>
          )}
        </form>
      </div>

      {/* 비밀번호 변경 */}
      <div className="stu-section stu-section--nested">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>비밀번호 변경</div>
        <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="현재 비밀번호"
            className="stu-input"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호"
            className="stu-input"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
            className="stu-input"
          />
          <button
            type="submit"
            className="stu-btn stu-btn--primary stu-btn--sm"
            disabled={updatePasswordMutation.isPending || !password.trim() || !newPassword.trim() || !confirmPassword.trim()}
          >
            {updatePasswordMutation.isPending ? "변경 중…" : "비밀번호 변경"}
          </button>
          {updatePasswordMutation.isError && (
            <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-danger)" }}>
              비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.
            </div>
          )}
          {updatePasswordMutation.isSuccess && (
            <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-success)" }}>
              비밀번호가 변경되었습니다.
            </div>
          )}
        </form>
      </div>
    </StudentPageShell>
  );
}
