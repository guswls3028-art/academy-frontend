/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/staff/pages/StaffManagePage.tsx
// 직원 관리 — 목록 + 등록 + 편집/퇴사 처리 + 시급태그 + 비밀번호
import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { ChevronLeft, Plus, Pencil, Trash2, Search } from "@teacher/shared/ui/Icons";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import api from "@/shared/api/axios";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import { teacherStaffQueryKeys } from "../queryKeys";
import {
  generateTemporaryPassword,
  isPasswordConfirmationReady,
} from "@/shared/auth/passwordPolicy";
import { PasswordChecklist, PasswordInput } from "@/shared/ui/password";

/* ─── API (복수형 /staffs/ — 백엔드 실제 엔드포인트) ─── */
async function fetchStaff(search?: string) {
  const res = await api.get("/staffs/", { params: { page_size: 500, search: search || undefined } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

async function createStaff(payload: { name: string; phone?: string; role?: string; username: string; password: string }) {
  const res = await api.post("/staffs/", payload);
  return res.data;
}

async function updateStaff(id: number, payload: Record<string, unknown>) {
  const res = await api.patch(`/staffs/${id}/`, payload);
  return res.data;
}

async function resetStaffPassword(id: number, password: string) {
  const res = await api.post(`/staffs/${id}/change-password/`, { password });
  return res.data;
}

/* ─── Page ─── */
export default function StaffManagePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const { data: staff, isLoading, isError, error, refetch } = useQuery({
    queryKey: teacherStaffQueryKeys.staffList(search),
    queryFn: () => fetchStaff(search || undefined),
  });

  const offboardMut = useMutation({
    mutationFn: (id: number) => updateStaff(id, { is_active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherStaffQueryKeys.staff });
      teacherToast.info("퇴사 처리했습니다. 기존 근무·비용·급여 이력은 보존됩니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "퇴사 처리하지 못했습니다.")),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button type="button" aria-label="이전 화면" onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>직원 관리</h1>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={ICON.xs} /> 직원 추가
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={ICON.sm} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tc-text-muted)" }} />
        <input type="text" placeholder="이름 / 전화번호 검색" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm"
          style={{ padding: "10px 12px 10px 36px", border: "1px solid var(--tc-border-strong)", borderRadius: "var(--tc-radius)", background: "var(--tc-surface)", color: "var(--tc-text)", outline: "none" }} />
      </div>

      {/* List */}
      {isLoading ? <EmptyState scope="panel" tone="loading" title="불러오는 중..." /> :
        isError ? (
          <EmptyState
            scope="panel"
            tone="error"
            title="직원 목록을 불러오지 못했습니다"
            description={extractApiError(error, "연결 상태를 확인한 뒤 다시 시도해 주세요.")}
            actions={
              <EmptyActionButton onClick={() => void refetch()}>
                다시 시도
              </EmptyActionButton>
            }
          />
        ) :
        staff && staff.length > 0 ? (
          <div className="flex flex-col gap-2">
            {staff.map((s: any) => (
              <Card key={s.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`${s.name || s.username} 직원 상세`}
                    onClick={() => navigate(`/workspace/mobile/staff/${s.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-left"
                    style={{ padding: 0, border: "none", background: "none" }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
                      {(s.name || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{s.name || s.username}</span>
                        <Badge tone="neutral" size="xs">{s.role === "TEACHER" ? "강사" : s.role === "owner" ? "원장" : "조교"}</Badge>
                        <Badge tone={s.is_active === false ? "danger" : "success"} size="xs">
                          {s.is_active === false ? "퇴사" : "재직"}
                        </Badge>
                      </div>
                      {s.phone && <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{s.phone}</div>}
                    </div>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" aria-label={`${s.name || s.username} 직원 수정`} onClick={() => setEditTarget(s)} className="flex p-1.5 cursor-pointer"
                      style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}><Pencil size={ICON.md} /></button>
                    {s.is_active !== false && (
                      <button type="button" aria-label={`${s.name || s.username} 퇴사 처리`} onClick={async () => {
                          const ok = await confirm({
                            title: "퇴사 처리",
                            message: `${s.name}의 로그인을 중지하고 퇴사 처리할까요? 기존 근무·비용·급여 이력은 보존됩니다.`,
                            confirmText: "퇴사 처리",
                            danger: true,
                          });
                          if (ok) offboardMut.mutate(s.id);
                        }}
                        className="flex p-1.5 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-danger)" }}><Trash2 size={ICON.md} /></button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            scope="panel"
            tone="empty"
            title={search.trim() ? "검색된 직원이 없습니다" : "등록된 직원이 없습니다"}
            description={search.trim() ? "검색어를 지우면 전체 직원 목록을 다시 확인할 수 있습니다." : "직원을 추가하면 근태, 비용, 급여 관리를 한 화면에서 이어갈 수 있습니다."}
            actions={
              search.trim() ? (
                <EmptyActionButton variant="secondary" onClick={() => setSearch("")}>
                  검색 초기화
                </EmptyActionButton>
              ) : (
                <EmptyActionButton onClick={() => setCreateOpen(true)}>
                  직원 추가
                </EmptyActionButton>
              )
            }
          />
        )}

      {createOpen && <StaffFormSheet open onClose={() => setCreateOpen(false)} />}
      {editTarget && <StaffFormSheet open={!!editTarget} onClose={() => setEditTarget(null)} editData={editTarget} />}
    </div>
  );
}

/* ─── Staff Form Sheet ─── */
function StaffFormSheet({ open, onClose, editData }: { open: boolean; onClose: () => void; editData?: any }) {
  const qc = useQueryClient();
  const isEdit = !!editData;
  const [name, setName] = useState(editData?.name || "");
  const [phone, setPhone] = useState(editData?.phone || "");
  const [username, setUsername] = useState(editData?.username || "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [role, setRole] = useState(editData?.role || "ASSISTANT");
  const [isActive, setIsActive] = useState(editData?.is_active !== false);
  const passwordReady = isPasswordConfirmationReady(password.trim(), passwordConfirmation.trim());
  const canSubmit = isEdit
    ? !!name.trim()
    : !!name.trim() && !!username.trim() && passwordReady;
  const canResetPassword = isEdit && passwordReady;

  const handleGeneratePassword = () => {
    try {
      const generated = generateTemporaryPassword();
      setPassword(generated);
      setPasswordConfirmation(generated);
      teacherToast.success("안전한 비밀번호를 만들었습니다.");
    } catch (error: unknown) {
      teacherToast.error(extractApiError(error, "비밀번호를 자동으로 만들 수 없습니다."));
    }
  };

  const handleCopyPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      teacherToast.success("비밀번호를 복사했습니다. 안전한 방법으로 전달해 주세요.");
    } catch {
      teacherToast.error("복사하지 못했습니다. 비밀번호 보기 후 직접 복사해 주세요.");
    }
  };

  const createMut = useMutation({
    mutationFn: () => {
      if (isEdit) {
        const payload: Record<string, unknown> = {
          name: name.trim(),
          phone: phone.trim() || undefined,
          is_active: isActive,
        };
        if (isActive) payload.role = role;
        return updateStaff(editData.id, payload);
      }
      return createStaff({
          name: name.trim(),
          phone: phone.trim() || undefined,
          username: username.trim(),
          password: password.trim(),
          role,
        });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherStaffQueryKeys.staff });
      teacherToast.success(isEdit ? "직원 정보가 수정되었습니다." : `${name} 직원이 등록되었습니다.`);
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, isEdit ? "직원 정보를 수정하지 못했습니다." : "직원을 등록하지 못했습니다.")),
  });

  const pwResetMut = useMutation({
    mutationFn: () => resetStaffPassword(editData?.id, password.trim()),
    onSuccess: () => {
      setPassword("");
      setPasswordConfirmation("");
      teacherToast.success("비밀번호가 설정되었습니다. 기존 로그인은 만료됩니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "비밀번호를 변경하지 못했습니다.")),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? "직원 편집" : "직원 추가"}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Fld label="이름 *" value={name} onChange={setName} placeholder="직원 이름" />
        <Fld label="전화" value={phone} onChange={setPhone} type="tel" placeholder="010-" />
        {!isEdit && <Fld label="아이디 *" value={username} onChange={setUsername} placeholder="로그인 아이디" />}
        {!isEdit && (
          <StaffPasswordFields
            password={password}
            confirmation={passwordConfirmation}
            onPasswordChange={setPassword}
            onConfirmationChange={setPasswordConfirmation}
            onGenerate={handleGeneratePassword}
            onCopy={handleCopyPassword}
            label="초기 비밀번호 *"
          />
        )}

        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>역할</label>
          <div className="flex gap-2">
            {[["TEACHER", "강사"], ["ASSISTANT", "조교"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setRole(v)}
                className="flex-1 text-[12px] font-semibold py-2 cursor-pointer text-center"
                style={{
                  borderRadius: "var(--tc-radius)",
                  border: role === v ? "2px solid var(--tc-primary)" : "1px solid var(--tc-border)",
                  background: role === v ? "var(--tc-primary-bg)" : "var(--tc-surface-soft)",
                  color: role === v ? "var(--tc-primary)" : "var(--tc-text-secondary)",
                }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {isEdit && (
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>재직 상태</label>
            <button
              type="button"
              onClick={() => setIsActive((value) => !value)}
              className="w-full text-[12px] font-semibold py-2 cursor-pointer text-center"
              style={{
                borderRadius: "var(--tc-radius)",
                border: `1px solid ${isActive ? "var(--tc-success)" : "var(--tc-danger)"}`,
                background: isActive ? "var(--tc-success-bg)" : "var(--tc-danger-bg)",
                color: isActive ? "var(--tc-success)" : "var(--tc-danger)",
              }}
            >
              {isActive ? "재직" : "퇴사"}
            </button>
            <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
              퇴사 처리 시 로그인은 중지되고 기존 이력은 보존됩니다.
            </div>
          </div>
        )}

        <button onClick={() => createMut.mutate()} disabled={!canSubmit || createMut.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: canSubmit ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: canSubmit ? "#fff" : "var(--tc-text-muted)" }}>
          {createMut.isPending ? "저장 중..." : isEdit ? "수정" : "등록"}
        </button>

        {isEdit && (
          <div className="flex flex-col gap-2.5 mt-2 pt-3" style={{ borderTop: "1px solid var(--tc-border-subtle)" }}>
            <div>
              <div className="text-[13px] font-bold" style={{ color: "var(--tc-text)" }}>비밀번호 재설정</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
                직원 정보 저장과 별도 작업입니다. 변경하면 기존 로그인이 만료됩니다.
              </div>
            </div>
            <StaffPasswordFields
              password={password}
              confirmation={passwordConfirmation}
              onPasswordChange={setPassword}
              onConfirmationChange={setPasswordConfirmation}
              onGenerate={handleGeneratePassword}
              onCopy={handleCopyPassword}
              label="새 비밀번호"
            />
            <button onClick={() => pwResetMut.mutate()} disabled={!canResetPassword || pwResetMut.isPending}
              className="w-full text-sm font-semibold cursor-pointer"
              style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-warn)", background: "none", color: canResetPassword ? "var(--tc-warn)" : "var(--tc-text-muted)", opacity: pwResetMut.isPending ? 0.6 : 1 }}>
              {pwResetMut.isPending ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function StaffPasswordFields({
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  onGenerate,
  onCopy,
  label,
}: {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  onGenerate: () => void;
  onCopy: () => void;
  label: string;
}) {
  const inputStyle = {
    padding: "8px 10px",
    borderRadius: "var(--tc-radius-sm)",
    border: "1px solid var(--tc-border-strong)",
    background: "var(--tc-surface-soft)",
    color: "var(--tc-text)",
    outline: "none",
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label htmlFor="teacher-staff-password" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
        <PasswordInput
          id="teacher-staff-password"
          label={label.replace(" *", "")}
          value={password}
          onValueChange={onPasswordChange}
          placeholder="4자 이상"
          autoComplete="new-password"
          inputClassName="text-sm"
          inputStyle={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="teacher-staff-password-confirmation" className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>비밀번호 확인 *</label>
        <PasswordInput
          id="teacher-staff-password-confirmation"
          label="비밀번호 확인"
          value={confirmation}
          onValueChange={onConfirmationChange}
          placeholder="한 번 더 입력"
          autoComplete="new-password"
          inputClassName="text-sm"
          inputStyle={inputStyle}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={onGenerate} className="text-[11px] font-semibold cursor-pointer"
          style={{ padding: "6px 9px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-primary)" }}>
          안전한 비밀번호 만들기
        </button>
        <button type="button" onClick={onCopy} disabled={!password} className="text-[11px] font-semibold cursor-pointer"
          style={{ padding: "6px 9px", borderRadius: "var(--tc-radius-sm)", border: "none", background: "transparent", color: password ? "var(--tc-text-secondary)" : "var(--tc-text-muted)" }}>
          복사
        </button>
      </div>
      <PasswordChecklist password={password} confirmation={confirmation} />
    </div>
  );
}

function Fld({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}
