/**
 * 프로필 — 선생앱 학생 필드 스펙과 동일 (이름, 로그인 아이디, 학부모/학생 전화, 성별, 주소)
 * 아이디·비밀번호 변경은 별도 블록
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { fetchMyProfile, updateMyProfile } from "../api/profile";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { IconPencil } from "@/student/shared/ui/icons/Icons";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";

function formatPhone(phone: string | null | undefined): string {
  if (!phone || !phone.trim()) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("010")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatGender(g: string | null | undefined): string {
  if (g === "M") return "남";
  if (g === "F") return "여";
  return "-";
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGender, setEditGender] = useState<string>("");
  const [editAddress, setEditAddress] = useState("");
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || "");
      setEditParentPhone(profile.parent_phone || "");
      setEditPhone(profile.phone || "");
      setEditGender(profile.gender || "");
      setEditAddress(profile.address || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: {
      name?: string;
      username?: string;
      current_password?: string;
      new_password?: string;
      phone?: string | null;
      parent_phone?: string;
      gender?: string | null;
      address?: string | null;
    }) => updateMyProfile(payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["student", "me"] });
      setEditing(false);
      if (variables.username !== undefined) {
        setShowUsernameForm(false);
        setUsername("");
      }
      if (variables.new_password !== undefined) {
        setShowPasswordForm(false);
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    },
  });

  const startEdit = () => {
    if (profile) {
      setEditName(profile.name || "");
      setEditParentPhone(profile.parent_phone || "");
      setEditPhone(profile.phone || "");
      setEditGender(profile.gender || "");
      setEditAddress(profile.address || "");
      setEditing(true);
    }
  };

  const saveProfile = () => {
    const parentRaw = editParentPhone.replace(/\D/g, "");
    const phoneRaw = editPhone.replace(/\D/g, "");
    updateProfileMutation.mutate({
      name: editName.trim() || undefined,
      parent_phone: parentRaw.length >= 10 ? "010" + parentRaw.slice(-8) : undefined,
      phone: phoneRaw.length >= 10 ? "010" + phoneRaw.slice(-8) : (editPhone.trim() || null),
      gender: editGender === "M" || editGender === "F" ? editGender : null,
      address: editAddress.trim() || null,
    });
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    updateProfileMutation.mutate({ username: username.trim() });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !newPassword.trim()) return;
    if (newPassword !== confirmPassword) {
      alert("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    updateProfileMutation.mutate({
      current_password: password,
      new_password: newPassword,
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
      {/* 기본 정보 — 선생앱 학생 필드 스펙(이름, 로그인 아이디, 학부모/학생 전화, 성별, 주소) */}
      <div className="stu-section stu-section--nested" style={{ marginBottom: "var(--stu-space-6)" }}>
        <div style={{ position: "relative", paddingRight: 36 }}>
          <button
            type="button"
            className="stu-btn stu-btn--ghost stu-btn--sm"
            onClick={editing ? () => setEditing(false) : startEdit}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              padding: "var(--stu-space-2)",
            }}
            title={editing ? "취소" : "편집"}
          >
            <IconPencil style={{ width: 20, height: 20, color: "var(--stu-primary)" }} />
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>이름</div>
              {editing ? (
                <div style={{ display: "flex", gap: "var(--stu-space-2)", alignItems: "center" }}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="stu-input"
                    style={{ flex: 1, maxWidth: 200 }}
                    placeholder="이름"
                  />
                </div>
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.name || "-"}</div>
              )}
            </div>

            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>로그인 아이디</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.username || "-"}</div>
            </div>

            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>학부모 전화번호</div>
              {editing ? (
                <PhoneInput010Blocks
                  value={editParentPhone.replace(/\D/g, "").length >= 11 ? editParentPhone : editParentPhone.replace(/\D/g, "").startsWith("010") ? editParentPhone : "010" + editParentPhone.replace(/\D/g, "").slice(-8)}
                  onChange={(v) => setEditParentPhone(v)}
                  inputClassName="stu-input"
                  blockClassName="stu-phone-block"
                  aria-label="학부모 전화번호"
                />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>{formatPhone(profile.parent_phone)}</div>
              )}
            </div>

            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>학생 전화번호</div>
              {editing ? (
                <PhoneInput010Blocks
                  value={editPhone.replace(/\D/g, "").length >= 11 ? editPhone : editPhone.replace(/\D/g, "").startsWith("010") ? editPhone : "010" + editPhone.replace(/\D/g, "").slice(-8)}
                  onChange={(v) => setEditPhone(v)}
                  inputClassName="stu-input"
                  blockClassName="stu-phone-block"
                  placeholder="선택"
                  aria-label="학생 전화번호"
                />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.phone ? formatPhone(profile.phone) : "-"}</div>
              )}
            </div>

            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>성별</div>
              {editing ? (
                <div style={{ display: "flex", gap: "var(--stu-space-2)" }}>
                  {[
                    { key: "M", label: "남" },
                    { key: "F", label: "여" },
                  ].map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      className={`stu-btn stu-btn--secondary ${editGender === g.key ? "stu-btn--primary" : ""}`}
                      onClick={() => setEditGender(g.key)}
                      style={{ padding: "var(--stu-space-2) var(--stu-space-4)" }}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>{formatGender(profile.gender)}</div>
              )}
            </div>

            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>주소</div>
              {editing ? (
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="stu-input"
                  style={{ width: "100%", maxWidth: 320 }}
                  placeholder="주소 (선택)"
                />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.address || "-"}</div>
              )}
            </div>

            {editing && (
              <div style={{ display: "flex", gap: "var(--stu-space-2)", marginTop: "var(--stu-space-2)" }}>
                <button
                  type="button"
                  className="stu-btn stu-btn--primary"
                  onClick={saveProfile}
                  disabled={updateProfileMutation.isPending || !editName.trim()}
                >
                  {updateProfileMutation.isPending ? "저장 중…" : "저장"}
                </button>
                <button
                  type="button"
                  className="stu-btn stu-btn--ghost"
                  onClick={() => setEditing(false)}
                >
                  취소
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 아이디 변경 */}
      <div className="stu-section stu-section--nested" style={{ marginBottom: "var(--stu-space-6)" }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>아이디 변경</div>
        {!showUsernameForm ? (
          <button
            type="button"
            className="stu-btn stu-btn--secondary"
            onClick={() => setShowUsernameForm(true)}
          >
            아이디 변경하기
          </button>
        ) : (
          <form onSubmit={handleUsernameSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="새 로그인 아이디"
              className="stu-input"
            />
            <div style={{ display: "flex", gap: "var(--stu-space-2)" }}>
              <button
                type="button"
                className="stu-btn stu-btn--ghost"
                onClick={() => { setShowUsernameForm(false); setUsername(""); }}
              >
                취소
              </button>
              <button
                type="submit"
                className="stu-btn stu-btn--primary"
                disabled={updateProfileMutation.isPending || !username.trim()}
              >
                {updateProfileMutation.isPending ? "변경 중…" : "아이디 변경"}
              </button>
            </div>
            {updateProfileMutation.isError && (
              <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-danger)" }}>
                {(updateProfileMutation.error as any)?.response?.data?.detail || "아이디 변경에 실패했습니다."}
              </div>
            )}
          </form>
        )}
      </div>

      {/* 비밀번호 변경 */}
      <div className="stu-section stu-section--nested">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>비밀번호 변경</div>
        {!showPasswordForm ? (
          <button
            type="button"
            className="stu-btn stu-btn--secondary"
            onClick={() => setShowPasswordForm(true)}
          >
            비밀번호 변경하기
          </button>
        ) : (
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
            <div style={{ display: "flex", gap: "var(--stu-space-2)" }}>
              <button
                type="button"
                className="stu-btn stu-btn--ghost"
                onClick={() => { setShowPasswordForm(false); setPassword(""); setNewPassword(""); setConfirmPassword(""); }}
              >
                취소
              </button>
              <button
                type="submit"
                className="stu-btn stu-btn--primary"
                disabled={updateProfileMutation.isPending || !password.trim() || !newPassword.trim() || !confirmPassword.trim()}
              >
                {updateProfileMutation.isPending ? "변경 중…" : "비밀번호 변경"}
              </button>
            </div>
            {updateProfileMutation.isError && (
              <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-danger)" }}>
                {(updateProfileMutation.error as any)?.response?.data?.detail || "비밀번호 변경에 실패했습니다."}
              </div>
            )}
          </form>
        )}
      </div>
    </StudentPageShell>
  );
}
