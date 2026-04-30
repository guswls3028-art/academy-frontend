/**
 * 프로필 — 회원가입 모달과 동일 필드 (이름, 로그인 아이디, 학부모/학생 전화, 성별, 학교 정보, 주소, 메모)
 * 아이디·비밀번호 변경은 별도 블록
 */
import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { fetchMyProfile, updateMyProfile, updateMyProfilePhoto } from "../api/profile.api";
import EmptyState from "@student/layout/EmptyState";
import { IconPencil } from "@student/shared/ui/icons/Icons";
import { PhoneInput010Blocks } from "@/shared/ui/PhoneInput010Blocks";
import { studentToast } from "@student/shared/ui/feedback/studentToast";
import { useSchoolLevelMode } from "@/shared/hooks/useSchoolLevelMode";
import type { SchoolType } from "@/shared/hooks/useSchoolLevelMode";

/** 미입력 표시 JSX — italic 회색 */
const EMPTY_PLACEHOLDER = (
  <span style={{ fontStyle: "italic", color: "var(--stu-text-muted)", fontWeight: 400 }}>미입력</span>
);

function formatPhone(phone: string | null | undefined): React.ReactNode {
  if (!phone || !phone.trim()) return EMPTY_PLACEHOLDER;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("010")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatGender(g: string | null | undefined): React.ReactNode {
  if (g === "M") return "남";
  if (g === "F") return "여";
  return EMPTY_PLACEHOLDER;
}

/** 값이 없으면 미입력 placeholder, 있으면 그대로 반환 */
function valueOrEmpty(val: string | null | undefined): React.ReactNode {
  if (!val || !val.trim()) return EMPTY_PLACEHOLDER;
  return val;
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGender, setEditGender] = useState<string>("");
  const [editAddress, setEditAddress] = useState("");
  const [editSchoolType, setEditSchoolType] = useState<SchoolType>("HIGH");
  const [editHighSchool, setEditHighSchool] = useState("");
  const [editElementarySchool, setEditElementarySchool] = useState("");
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
  /** Track which form triggered the last mutation to show errors in the correct form only */
  const [lastMutationSource, setLastMutationSource] = useState<"profile" | "username" | "password" | null>(null);

  const slm = useSchoolLevelMode();

  const { data: profile, isLoading, isError, refetch } = useQuery({
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
      setEditSchoolType(
        profile.school_type === "ELEMENTARY" ? "ELEMENTARY" :
        profile.school_type === "MIDDLE" ? "MIDDLE" : "HIGH"
      );
      setEditHighSchool(profile.high_school || "");
      setEditElementarySchool(profile.elementary_school || "");
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
      studentToast.success("저장되었습니다.");
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
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail;
      studentToast.error(typeof detail === "string" ? detail : "저장에 실패했습니다.");
    },
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoMutation = useMutation({
    mutationFn: (file: File) => updateMyProfilePhoto(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", "me"] });
      studentToast.success("프로필 사진이 변경되었습니다.");
    },
    onError: () => {
      studentToast.error("사진 업로드에 실패했습니다.");
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      studentToast.error("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      studentToast.error("파일 크기는 5MB 이하여야 합니다.");
      return;
    }
    photoMutation.mutate(file);
    e.target.value = "";
  };

  const startEdit = () => {
    if (profile) {
      setEditName(profile.name || "");
      setEditParentPhone(profile.parent_phone || "");
      setEditPhone(profile.phone || "");
      setEditGender(profile.gender || "");
      setEditAddress(profile.address || "");
      setEditSchoolType(
        profile.school_type === "ELEMENTARY" ? "ELEMENTARY" :
        profile.school_type === "MIDDLE" ? "MIDDLE" : "HIGH"
      );
      setEditHighSchool(profile.high_school || "");
      setEditElementarySchool(profile.elementary_school || "");
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
    const validGrades = slm.gradeRange(editSchoolType);
    const gradeValid = gradeNum != null && !isNaN(gradeNum) && validGrades.includes(gradeNum);
    setLastMutationSource("profile");
    updateProfileMutation.mutate({
      name: editName.trim() || undefined,
      parent_phone: parentRaw.length >= 10 ? "010" + parentRaw.slice(-8) : undefined,
      phone: phoneRaw.length >= 10 ? "010" + phoneRaw.slice(-8) : (editPhone.trim() || null),
      gender: editGender === "M" || editGender === "F" ? editGender : null,
      address: editAddress.trim() || null,
      school_type: editSchoolType,
      high_school: editSchoolType === "HIGH" ? (editHighSchool.trim() || null) : null,
      elementary_school: editSchoolType === "ELEMENTARY" ? (editElementarySchool.trim() || null) : null,
      middle_school: editSchoolType === "MIDDLE" ? (editMiddleSchool.trim() || null) : null,
      origin_middle_school: slm.showOriginMiddleSchool(editSchoolType) ? (editOriginMiddleSchool.trim() || null) : null,
      grade: gradeValid ? gradeNum! : null,
      high_school_class: editHighSchoolClass.trim() || null,
      major: slm.showTrack(editSchoolType) ? (editMajor.trim() || null) : null,
      memo: editMemo.trim() || null,
    });
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLastMutationSource("username");
    updateProfileMutation.mutate({ username: username.trim() });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !newPassword.trim()) return;
    if (newPassword.length < 4) {
      studentToast.error("새 비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      studentToast.error("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setLastMutationSource("password");
    updateProfileMutation.mutate({
      current_password: password,
      new_password: newPassword,
    });
  };

  if (isLoading) {
    return (
      <StudentPageShell title="내 정보">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)", alignItems: "center" }}>
          <div className="stu-skel" style={{ width: 80, height: 80, borderRadius: "50%" }} />
          <div className="stu-skel" style={{ height: 20, width: "50%", borderRadius: "var(--stu-radius-sm)" }} />
          <div className="stu-skel" style={{ height: 140, width: "100%", borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 80, width: "100%", borderRadius: "var(--stu-radius)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (isError || !profile) {
    return (
      <StudentPageShell title="내 정보">
        <EmptyState
          title="프로필을 불러오지 못했습니다."
          description="잠시 후 다시 시도해주세요."
          onRetry={() => refetch()}
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
          학부모 계정으로 로그인 중입니다. 자녀 정보는 읽기 전용이며, 내 비밀번호는 아래에서 변경할 수 있습니다.
        </div>
      )}
      {/* 프로필 사진 */}
      {!profile.isParentReadOnly && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: "var(--stu-space-6)" }}>
          <div
            role="button"
            tabIndex={0}
            aria-label="프로필 사진 변경"
            onClick={() => photoInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); photoInputRef.current?.click(); } }}
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              overflow: "hidden",
              background: "var(--stu-surface-soft)",
              border: "3px solid var(--stu-border)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              transition: "border-color 0.2s",
            }}
          >
            {profile.profile_photo_url ? (
              <img
                src={profile.profile_photo_url}
                alt="프로필"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 32, fontWeight: 700, color: "var(--stu-text-muted)" }}>
                {(profile.name || "?")[0]}
              </span>
            )}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 24,
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoSelect}
          />
          <button
            type="button"
            className="stu-btn stu-btn--ghost stu-btn--sm"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoMutation.isPending}
            style={{ fontSize: 13, color: "var(--stu-primary)" }}
          >
            {photoMutation.isPending ? "업로드 중..." : "사진 변경"}
          </button>
        </div>
      )}

      {/* 기본 정보 */}
      <div className="stu-section stu-section--nested" style={{ marginBottom: "var(--stu-space-6)" }}>
        {profile.isParentReadOnly && (
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-3)" }}>자녀 정보</div>
        )}
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
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "var(--stu-space-2) var(--stu-space-3)",
              minHeight: 36,
              borderRadius: "var(--stu-radius-sm)",
              color: "var(--stu-primary)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <IconPencil style={{ width: 16, height: 16 }} />
            {editing ? "취소" : "편집"}
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
                <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.name)}</div>
              )}
            </div>

            <div>
              <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>로그인 아이디</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.username)}</div>
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
                <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.phone ? formatPhone(profile.phone) : EMPTY_PLACEHOLDER}</div>
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
                <select
                  className="stu-select"
                  value={editSchoolType}
                  onChange={(e) => setEditSchoolType(e.target.value as SchoolType)}
                >
                  {slm.schoolTypes.map((key) => (
                    <option key={key} value={key}>{slm.getLabel(key)}</option>
                  ))}
                </select>
              ) : (
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  {slm.getLabel(profile.school_type as SchoolType)}
                </div>
              )}
            </div>

            {(editing ? editSchoolType : profile.school_type) === "HIGH" && (
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
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.high_school)}</div>
                  )}
                </div>
                {slm.showOriginMiddleSchool(editing ? editSchoolType : (profile.school_type as SchoolType)) && (
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
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.origin_middle_school)}</div>
                    )}
                  </div>
                )}
              </>
            )}
            {(editing ? editSchoolType : profile.school_type) === "MIDDLE" && (
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
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.middle_school)}</div>
                )}
              </div>
            )}
            {(editing ? editSchoolType : profile.school_type) === "ELEMENTARY" && (
              <div>
                <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>초등학교명</div>
                {editing && !profile.isParentReadOnly ? (
                  <input
                    type="text"
                    value={editElementarySchool}
                    onChange={(e) => setEditElementarySchool(e.target.value)}
                    className="stu-input"
                    style={{ width: "100%", maxWidth: 280 }}
                    placeholder="초등학교명"
                  />
                ) : (
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.elementary_school)}</div>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--stu-space-4)" }}>
              <div style={{ minWidth: 80 }}>
                <div className="stu-muted" style={{ fontSize: 12, marginBottom: 4 }}>학년</div>
                {editing && !profile.isParentReadOnly ? (
                  <select
                    className="stu-select"
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                  >
                    <option value="">학년</option>
                    {slm.gradeRange(editSchoolType).map((g) => (
                      <option key={g} value={g}>{g}학년</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{profile.grade != null ? `${profile.grade}학년` : EMPTY_PLACEHOLDER}</div>
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
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.high_school_class)}</div>
                )}
              </div>
              {slm.showTrack(editSchoolType) && (
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
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.major)}</div>
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
                <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.address)}</div>
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
                <div style={{ fontWeight: 600, fontSize: 16 }}>{valueOrEmpty(profile.memo)}</div>
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
                  onClick={() => {
                    setEditing(false);
                    setEditSchoolType(
                      profile.school_type === "ELEMENTARY" ? "ELEMENTARY" :
                      profile.school_type === "MIDDLE" ? "MIDDLE" : "HIGH"
                    );
                  }}
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
            {updateProfileMutation.isError && lastMutationSource === "username" && (
              <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-danger)" }}>
                {(updateProfileMutation.error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail || "아이디 변경에 실패했습니다."}
              </div>
            )}
          </form>
        )}
      </div>
      )}

      {/* 비밀번호 변경 — 학부모도 자기 비밀번호 변경 가능 */}
      {(
      <div className="stu-section stu-section--nested">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--stu-space-4)" }}>
          {profile.isParentReadOnly ? "내 비밀번호 변경" : "비밀번호 변경"}
        </div>
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
            {updateProfileMutation.isError && lastMutationSource === "password" && (
              <div className="stu-muted" style={{ fontSize: 13, color: "var(--stu-danger)" }}>
                {(updateProfileMutation.error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail || "비밀번호 변경에 실패했습니다."}
              </div>
            )}
          </form>
        )}
      </div>
      )}
    </StudentPageShell>
  );
}
