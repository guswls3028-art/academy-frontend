/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/staff/pages/StaffManagePage.tsx
// 직원 관리 — 목록 + 등록 + 편집/삭제 + 시급태그 + 비밀번호 + 메시지
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Plus, Pencil, Trash2, Search } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import api from "@/shared/api/axios";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";

/* ─── API (복수형 /staffs/ — 백엔드 실제 엔드포인트) ─── */
async function fetchStaff(search?: string) {
  const res = await api.get("/staffs/", { params: { page_size: 100, search: search || undefined } });
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

async function deleteStaff(id: number) {
  await api.delete(`/staffs/${id}/`);
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

  const { data: staff, isLoading } = useQuery({
    queryKey: ["teacher-staff", search],
    queryFn: () => fetchStaff(search || undefined),
  });

  const deleteMut = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-staff"] }); teacherToast.info("직원이 삭제되었습니다."); },
    onError: (e) => teacherToast.error(extractApiError(e, "직원을 삭제하지 못했습니다.")),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>직원 관리</h1>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> 직원 등록
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tc-text-muted)" }} />
        <input type="text" placeholder="이름, 전화번호" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm"
          style={{ padding: "10px 12px 10px 36px", border: "1px solid var(--tc-border-strong)", borderRadius: "var(--tc-radius)", background: "var(--tc-surface)", color: "var(--tc-text)", outline: "none" }} />
      </div>

      {/* List */}
      {isLoading ? <EmptyState scope="panel" tone="loading" title="불러오는 중..." /> :
        staff && staff.length > 0 ? (
          <div className="flex flex-col gap-2">
            {staff.map((s: any) => (
              <Card key={s.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
                <div className="flex items-center gap-3">
                  <div onClick={() => navigate(`/teacher/staff/${s.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
                      {(s.name || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{s.name || s.username}</span>
                        <Badge tone="neutral" size="xs">{s.role === "TEACHER" ? "강사" : s.role === "owner" ? "원장" : "조교"}</Badge>
                      </div>
                      {s.phone && <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{s.phone}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditTarget(s)} className="flex p-1.5 cursor-pointer"
                      style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}><Pencil size={14} /></button>
                    <button onClick={async () => {
                        const ok = await confirm({ title: "직원 삭제", message: `${s.name}을(를) 삭제하시겠습니까?`, confirmText: "삭제", danger: true });
                        if (ok) deleteMut.mutate(s.id);
                      }}
                      className="flex p-1.5 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-danger)" }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : <EmptyState scope="panel" tone="empty" title="등록된 직원이 없습니다" />}

      <StaffFormSheet open={createOpen} onClose={() => setCreateOpen(false)} />
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
  const [role, setRole] = useState(editData?.role || "ASSISTANT");

  const createMut = useMutation({
    mutationFn: () => isEdit
      ? updateStaff(editData.id, { name, phone, role })
      : createStaff({ name, phone, username, password: password || "0000", role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-staff"] });
      teacherToast.success(isEdit ? "직원 정보가 수정되었습니다." : `${name} 직원이 등록되었습니다.`);
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, isEdit ? "직원 정보를 수정하지 못했습니다." : "직원을 등록하지 못했습니다.")),
  });

  const pwResetMut = useMutation({
    mutationFn: () => resetStaffPassword(editData?.id, password),
    onSuccess: () => { setPassword(""); teacherToast.success("비밀번호가 변경되었습니다."); },
    onError: (e) => teacherToast.error(extractApiError(e, "비밀번호를 변경하지 못했습니다.")),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? "직원 편집" : "직원 등록"}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Fld label="이름 *" value={name} onChange={setName} placeholder="직원 이름" />
        <Fld label="전화" value={phone} onChange={setPhone} type="tel" placeholder="010-" />
        {!isEdit && <Fld label="아이디 *" value={username} onChange={setUsername} placeholder="로그인 아이디" />}
        <Fld label={isEdit ? "새 비밀번호" : "초기 비밀번호"} value={password} onChange={setPassword} placeholder={isEdit ? "변경 시 입력" : "0000"} />

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

        <button onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: name.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: name.trim() ? "#fff" : "var(--tc-text-muted)" }}>
          {createMut.isPending ? "저장 중..." : isEdit ? "수정" : "등록"}
        </button>

        {isEdit && password && (
          <button onClick={() => pwResetMut.mutate()} disabled={pwResetMut.isPending}
            className="w-full text-sm font-semibold cursor-pointer"
            style={{ padding: "10px", borderRadius: "var(--tc-radius)", border: "1px solid var(--tc-warn)", background: "none", color: "var(--tc-warn)" }}>
            비밀번호 변경
          </button>
        )}
      </div>
    </BottomSheet>
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
