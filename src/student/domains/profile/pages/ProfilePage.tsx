/**
 * 프로필 — 회원가입 모달과 동일 필드 (이름, 로그인 아이디, 학부모/학생 전화, 성별, 학교 정보, 주소, 메모)
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
  const [editSchoolType, setEditSchoolType] = useState<"HIGH" | "MIDDLE">("HIGH");
  const [editHighSchool, setEditHighSchool] = useState("");
  const [editMiddleSchool, setEditMiddleSchool] = useState("");
  const [editOriginMiddleSchool, setEditOriginMiddleSchool] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editHighSchoolClass, setEditHighSchoolClass] = useState("");
  const [editMajor, setEditMajor] = useState("");
  const [editMemo, setEditMemo] = useState("");
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
      const p = (profile.parent_phone || "").replace(/\D/g, "");
      setEditParentPhone(p.length >= 8 ? "010" + p.slice(-8) : profile.parent_phone || "");
      const ph = (profile.phone || "").replace(/\D/g, "");
      setEditPhone(ph.length >= 8 ? "010" + ph.slice(-8) : profile.phone || "");
      setEditGender(profile.gender || "");
      setEditAddress(profile.address || "");
      setEditSchoolType(profile.school_type === "MIDDLE" ? "MIDDLE" : "HIGH");
      setEditHighSchool(profile.high_school || "");
      setEditMiddleSchool(profile.middle_school || "");
      setEditOriginMiddleSchool(profile.origin_middle_school || "");
      setEditGrade(profile.grade != null ? String(profile.grade) : "");
      setEditHighSchoolClass(profile.high_school_class || "");
      setEditMajor(profile.major || "");
      setEditMemo(profile.memo || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateMyProfile>[0]) => updateMyProfile(payload),
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
      setEditSchoolType(profile.school_type === "MIDDLE" ? "MIDDLE" : "HIGH");
      setEditHighSchool(profile.high_school || "");
      setEditMiddleSchool(profile.middle_school || "");
      setEditOriginMiddleSchool(profile.origin_middle_school || "");
      setEditGrade(profile.grade != null ? String(profile.grade) : "");
      setEditHighSchoolClass(profile.high_school_class || "");
      setEditMajor(profile.major || "");
      setEditMemo(profile.memo || "");
      setEditing(true);
    }
  };

  const saveProfile = () => {
    const parentRaw = editParentPhone.replace(/\D/g, "");
    const phoneRaw = editPhone.replace(/\D/g, "");
    const gradeNum = editGrade.trim() ? parseInt(editGrade, 10) : null;
    const gradeValid = gradeNum != null && !isNaN(gradeNum) && gradeNum >= 1 && gradeNum <= 3;
    updateProfileMutation.mutate({
      name: editName.trim() || undefined,
      parent_phone: parentRaw.length >= 10 ? "010" + parentRaw.slice(-8) : undefined,
      phone: phoneRaw.length >= 10 ? "010" + phoneRaw.slice(-8) : (editPhone.trim() || null),
      gender: editGender === "M" || editGender === "F" ? editGender : null,
      address: editAddress.trim() || null,
      school_type: editSchoolType,
      high_school: editSchoolType === "HIGH" ? (editHighSchool.trim() || null) : null,
      middle_school: editSchoolType === "MIDDLE" ? (editMiddleSchool.trim() || null) : null,
      origin_middle_school: editSchoolType === "HIGH" ? (editOriginMiddleSchool.trim() || null) : null,
      grade: gradeValid ? gradeNum! : null,
      high_school_class: editHighSchoolClass.trim() || null,
      major: editSchoolType === "HIGH" ? (editMajor.trim() || null) : null,
      memo: editMemo.trim() || null,
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
      {profile.isParentReadOnly && (
        <div
          role="alert"
          style={{
            marginBottom: "var(--stu-space-4)",
            padding: "var(--stu-space-3)",
            background: "var(--stu-surface-soft)",
            border: "1px solid var(--stu-border)",
            borderRadius: "var(--stu-radius)",
            fontSize: 14,
            color: "var(--stu-text-muted)",
          }}
        >
          학부모 계정은 읽기 전용입니다. 프로필·아이디·비밀번호 수정은 학생 계정으로 로그인 후 이용해 주세요.
        </div>
      )}
      {/* 기본 정보 — 선생앱 학생 필드 스펙(이름, 로그인 아이디, 학부모/학생 전화, 성별, 주소) */}
      <div className="stu-section stu-section--nested" style={{ marginBottom: "var(--stu-space-6)" }}>
        <div style={{ position: "relative", paddingRight: 36 }}>
          {!profile.isParentReadOnly && (
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
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>이름</div>
              {editing && !profile.isParentReadOnly ? (
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
              {editing && !profile.isParentReadOnly ? (
                <PhoneInput010Blocks
                  value={editParentPhone}
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
              {editing && !profile.isParentReadOnly ? (
                <PhoneInput010Blocks
                  value={editPhone}
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
              {editing && !profile.isParentReadOnly ? (
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

            {/* 학교 정보 — 회원가입 모달과 동일 */}
            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>학교 유형</div>
              {editing && !profile.isParentReadOnly ? (
                <div style={{ display: "flex", gap: "var(--stu-space-2)" }}>
                  {[
                    { key: "HIGH" as const, label: "고등" },
                    { key: "MIDDLE" as const, label: "중등" },
                  ].map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className={`stu-btn stu-btn--secondary ${editSchoolType === s.key ? "stu-btn--primary" : ""}`}
                      onClick={() => setEditSchoolType(s.key)}
                      style={{ padding: "var(--stu-space-2) var(--stu-space-4)" }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  {profile.school_type === "MIDDLE" ? "중등" : "고등"}
                </div>
              )}
            </div>

            {editSchoolType === "HIGH" && (
              <>
                <div>
                  <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>고등학교명</div>
                  {editing && !profile.isParentReadOnly ? (
                    <input
                      type="text"
                      value={editHighSchool}
                      onChange={(e) => setEditHighSchool(e.target.value)}
                      className="stu-input"
                      style={{ width: "100%", maxWidth: 280 }}
                      placeholder="고등학교명"
                    />
                  ) : (
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.high_school || "-"}</div>
                  )}
                </div>
                <div>
                  <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>출신중학교</div>
                  {editing && !profile.isParentReadOnly ? (
                    <input
                      type="text"
                      value={editOriginMiddleSchool}
                      onChange={(e) => setEditOriginMiddleSchool(e.target.value)}
                      className="stu-input"
                      style={{ width: "100%", maxWidth: 280 }}
                      placeholder="출신중학교"
                    />
                  ) : (
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.origin_middle_school || "-"}</div>
                  )}
                </div>
              </>
            )}
            {editSchoolType === "MIDDLE" && (
              <div>
                <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>중학교명</div>
                {editing && !profile.isParentReadOnly ? (
                  <input
                    type="text"
                    value={editMiddleSchool}
                    onChange={(e) => setEditMiddleSchool(e.target.value)}
                    className="stu-input"
                    style={{ width: "100%", maxWidth: 280 }}
                    placeholder="중학교명"
                  />
                ) : (
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.middle_school || "-"}</div>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--stu-space-4)" }}>
              <div style={{ minWidth: 80 }}>
                <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>학년</div>
                {editing && !profile.isParentReadOnly ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value.replace(/\D/g, "").slice(0, 1))}
                    className="stu-input"
                    style={{ width: 56 }}
                    placeholder="1~3"
                  />
                ) : (
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.grade != null ? `${profile.grade}학년` : "-"}</div>
                )}
              </div>
              <div style={{ minWidth: 80 }}>
                <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>반</div>
                {editing && !profile.isParentReadOnly ? (
                  <input
                    type="text"
                    value={editHighSchoolClass}
                    onChange={(e) => setEditHighSchoolClass(e.target.value)}
                    className="stu-input"
                    style={{ width: 72 }}
                    placeholder="반"
                  />
                ) : (
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.high_school_class || "-"}</div>
                )}
              </div>
              {editSchoolType === "HIGH" && (
                <div style={{ minWidth: 120 }}>
                  <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>계열</div>
                  {editing && !profile.isParentReadOnly ? (
                    <input
                      type="text"
                      value={editMajor}
                      onChange={(e) => setEditMajor(e.target.value)}
                      className="stu-input"
                      style={{ width: "100%", maxWidth: 140 }}
                      placeholder="계열 (선택)"
                    />
                  ) : (
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.major || "-"}</div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>주소</div>
              {editing && !profile.isParentReadOnly ? (
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

            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>메모</div>
              {editing && !profile.isParentReadOnly ? (
                <textarea
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  className="stu-input"
                  style={{ width: "100%", maxWidth: 320, minHeight: 60, resize: "vertical" }}
                  placeholder="메모 (선택)"
                />
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.memo || "-"}</div>
              )}
            </div>

            {editing && !profile.isParentReadOnly && (
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

      {/* 아이디 변경 — 학부모는 숨김 */}
      {!profile.isParentReadOnly && (
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
      )}

      {/* 비밀번호 변경 — 학부모는 숨김 */}
      {!profile.isParentReadOnly && (
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
      )}
    </StudentPageShell>
  );
}
