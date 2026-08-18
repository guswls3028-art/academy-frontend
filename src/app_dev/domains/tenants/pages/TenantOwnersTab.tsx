import { useState } from "react";
import { useNavigate } from "react-router";
import {
  useImpersonate,
  useRegisterOwner,
  useRemoveOwner,
  useTenantOwners,
  useUpdateOwner,
} from "@dev/domains/tenants/hooks/useTenants";
import {
  abortImpersonation,
  beginImpersonation,
} from "@dev/shared/components/impersonationSession";
import { useDevToast } from "@dev/shared/components/useDevToast";
import s from "@dev/layout/DevLayout.module.css";
import styles from "./TenantDetailPage.module.css";

type TenantOwnerApiError = {
  response?: {
    data?: {
      detail?: string;
      currentRole?: string;
    };
  };
};

function tenantOwnerErrorMessage(error: unknown): string {
  const detail = (error as TenantOwnerApiError).response?.data?.detail;
  const messages: Record<string, string> = {
    owner_already_registered: "이미 등록된 소유자입니다. 목록을 새로고침했습니다.",
    owner_existing_user_not_found: "승격할 기존 계정을 찾지 못했습니다.",
    owner_identifier_ambiguous: "같은 아이디의 계정이 여러 개입니다. 계정 중복을 먼저 정리해주세요.",
    owner_password_required: "신규 계정을 만들려면 임시 비밀번호가 필요합니다.",
    owner_registration_invalid: "아이디·이름·전화번호의 길이와 형식을 확인해주세요.",
    owner_user_inactive: "비활성 계정은 소유자로 승격할 수 없습니다. 계정을 먼저 활성화해주세요.",
  };
  return (detail && messages[detail]) || detail || "등록 실패";
}

export function TenantOwnersTab({ tenantId, tenantName }: { tenantId: number; tenantName: string }) {
  const navigate = useNavigate();
  const { data: owners, isLoading, isError, refetch } = useTenantOwners(tenantId);
  const registerOwner = useRegisterOwner();
  const impersonate = useImpersonate();
  const updateOwner = useUpdateOwner();
  const removeOwner = useRemoveOwner();
  const { toast } = useDevToast();

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  function resetAddForm() {
    setShowAdd(false);
    setNewUser("");
    setNewPw("");
    setNewName("");
    setNewPhone("");
  }

  async function handleAdd() {
    const username = newUser.trim();
    if (!username) { toast("아이디를 입력하세요.", "error"); return; }
    try {
      await registerOwner.mutateAsync({
        tenantId,
        username,
        password: newPw || undefined,
        name: newName.trim() || undefined,
        phone: newPhone.trim() || undefined,
      });
      toast(`${username} 등록 완료`);
      resetAddForm();
    } catch (e: unknown) {
      const data = (e as TenantOwnerApiError).response?.data;
      if (data?.detail === "owner_promotion_confirmation_required") {
        const currentRole = data.currentRole || "일반 사용자";
        const confirmed = window.confirm(
          `${username}은(는) 이미 이 테넌트의 ${currentRole} 계정입니다.\n` +
          "기존 비밀번호·이름·전화번호는 그대로 두고 소유자로 승격할까요?",
        );
        if (!confirmed) return;
        try {
          await registerOwner.mutateAsync({
            tenantId,
            username,
            promoteExisting: true,
          });
          toast(`${username} 소유자 승격 완료`);
          resetAddForm();
          return;
        } catch (promotionError: unknown) {
          toast(tenantOwnerErrorMessage(promotionError), "error");
          return;
        }
      }
      if (data?.detail === "owner_already_registered") {
        await refetch();
      }
      toast(tenantOwnerErrorMessage(e), "error");
    }
  }

  async function handleSaveEdit(userId: number) {
    try {
      await updateOwner.mutateAsync({ tenantId, userId, name: editName || undefined, phone: editPhone || undefined });
      toast("수정 완료");
      setEditId(null);
    } catch {
      toast("수정 실패", "error");
    }
  }

  async function handleRemove(userId: number, username: string) {
    if (!confirm(`${username}을(를) ${tenantName}에서 제거할까요?`)) return;
    try {
      await removeOwner.mutateAsync({ tenantId, userId });
      toast("제거 완료");
    } catch {
      toast("제거 실패", "error");
    }
  }

  if (isLoading) {
    return <div className={`${s.skeleton} ${styles.skeletonShort}`} />;
  }

  if (isError) {
    return (
      <div className={`${s.card} ${styles.cardSpacing}`} role="alert">
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>소유자 조회 실패</h3>
        </div>
        <div className={s.empty}>
          <div className={s.emptyText}>현재 소유자 목록을 불러오지 못했습니다. 중복 등록을 막기 위해 추가 기능을 잠시 비활성화했습니다.</div>
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={() => void refetch()}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`${s.card} ${styles.cardSpacing}`}>
        <div className={s.cardHeader}>
          <h3 className={s.cardTitle}>소유자 ({owners?.length ?? 0})</h3>
          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={() => setShowAdd(!showAdd)}>
            + 소유자 추가
          </button>
        </div>

        {showAdd && (
          <div className={styles.ownerCreatePanel}>
            <div className={styles.ownerFormGrid}>
              <div>
                <label className={s.inputLabel}>아이디 *</label>
                <input className={s.input} value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="admin97" />
              </div>
              <div>
                <label className={s.inputLabel}>신규 계정 임시 비밀번호</label>
                <input className={s.input} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </div>
              <div>
                <label className={s.inputLabel}>이름</label>
                <input className={s.input} value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <label className={s.inputLabel}>전화번호</label>
                <input className={s.input} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
            </div>
            <p className={styles.ownerFormHint}>
              신규 계정이면 임시 비밀번호가 필수입니다. 기존 계정이면 아이디만 확인한 뒤 별도 승격 확인을 거치며, 기존 비밀번호와 프로필은 변경하지 않습니다.
            </p>
            <div className={styles.ownerFormActions}>
              <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={resetAddForm}>취소</button>
              <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={handleAdd} disabled={registerOwner.isPending}>
                {registerOwner.isPending ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        )}

        {!owners?.length ? (
          <div className={s.empty}>
            <div className={s.emptyText}>등록된 소유자가 없습니다.</div>
          </div>
        ) : (
          <table className={`${s.table} ${styles.ownerTable}`}>
            <thead>
              <tr>
                <th>아이디</th>
                <th>이름</th>
                <th>전화번호</th>
                <th>역할</th>
                <th className={styles.tableActionsHeader}>동작</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.userId}>
                  {editId === o.userId ? (
                    <>
                      <td className={styles.strongCell} data-label="아이디">{o.username}</td>
                      <td data-label="이름"><input className={`${s.input} ${styles.compactInput}`} value={editName} onChange={(e) => setEditName(e.target.value)} /></td>
                      <td data-label="전화번호"><input className={`${s.input} ${styles.compactInput}`} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></td>
                      <td data-label="역할">
                        <div className={styles.badgeStack}>
                          <span className={`${s.badge} ${s.badgeActive}`}>소유자</span>
                          {o.isActive === false && <span className={`${s.badge} ${s.badgeInactive}`}>계정 비활성</span>}
                        </div>
                      </td>
                      <td data-label="동작">
                        <div className={styles.tableActions}>
                          <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={() => handleSaveEdit(o.userId)}>저장</button>
                          <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`} onClick={() => setEditId(null)}>취소</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={styles.strongCell} data-label="아이디">{o.username}</td>
                      <td data-label="이름">{o.name || "—"}</td>
                      <td className={styles.mutedCell} data-label="전화번호">{o.phone || "—"}</td>
                      <td data-label="역할">
                        <div className={styles.badgeStack}>
                          <span className={`${s.badge} ${s.badgeActive}`}>소유자</span>
                          {o.isActive === false && <span className={`${s.badge} ${s.badgeInactive}`}>계정 비활성</span>}
                        </div>
                      </td>
                      <td data-label="동작">
                        <div className={styles.tableActions}>
                          <button
                            type="button"
                            className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
                            disabled={impersonate.isPending}
                            onClick={async () => {
                              const ok = window.confirm(
                                `[임퍼소네이션]\n${tenantName}의 ${o.username}으로 로그인합니다.\n` +
                                `현재 dev 토큰은 보존되며, 상단 배너에서 언제든 복귀할 수 있습니다.`,
                              );
                              if (!ok) return;
                              try {
                                beginImpersonation(`${tenantName} / ${o.username}`);
                                const r = await impersonate.mutateAsync({ tenantId, userId: o.userId });
                                localStorage.setItem("access", r.access);
                                localStorage.setItem("refresh", r.refresh);
                                navigate("/workspace", { replace: true });
                                window.location.reload();
                              } catch (e: unknown) {
                                abortImpersonation();
                                const err = e as { response?: { data?: { detail?: string } } };
                                window.alert("임퍼소네이션 실패: " + (err.response?.data?.detail || String(e)));
                              }
                            }}
                            title="이 사용자로 로그인 (감사 로그 기록)"
                          >
                            로그인
                          </button>
                          <button
                            type="button"
                            className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                            onClick={() => { setEditId(o.userId); setEditName(o.name || ""); setEditPhone(o.phone ?? ""); }}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                            onClick={() => handleRemove(o.userId, o.username)}
                            disabled={removeOwner.isPending}
                          >
                            제거
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.ownerNotice}>
        이 계정은 <strong>{tenantName}</strong> 전용입니다. 다른 테넌트에서는 로그인할 수 없습니다.
      </div>
    </>
  );
}

