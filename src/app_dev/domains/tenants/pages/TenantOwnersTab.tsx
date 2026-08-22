import { useState } from "react";
import { useNavigate } from "react-router";
import {
  useImpersonate,
  useRegisterOwner,
  useRemoveOwner,
  useResetOwnerPassword,
  useTenantOwners,
  useUpdateOwner,
} from "@dev/domains/tenants/hooks/useTenants";
import {
  abortImpersonation,
  activateImpersonation,
  beginImpersonation,
} from "@dev/shared/components/impersonationSession";
import { useDevToast } from "@dev/shared/components/useDevToast";
import type {
  TenantOwnerDto,
  TenantOwnerHandoffStatus,
} from "@dev/domains/tenants/api/tenants.api";
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
    owner_password_reset_invalid: "임시 비밀번호는 4~128자로 입력해주세요.",
    owner_user_inactive: "비활성 계정은 소유자로 승격할 수 없습니다. 계정을 먼저 활성화해주세요.",
  };
  return (detail && messages[detail]) || detail || "등록 실패";
}

function ownerHandoffStatus(owner: TenantOwnerDto): TenantOwnerHandoffStatus {
  if (owner.handoffStatus) return owner.handoffStatus;
  if (owner.isActive === false) return "account_inactive";
  if (!owner.hasUsablePassword) return "password_setup_required";
  if (owner.mustChangePassword) return "first_login_pending";
  return "complete";
}

const OWNER_HANDOFF_COPY: Record<TenantOwnerHandoffStatus, {
  label: string;
  detail: string;
  stage: 0 | 1 | 2;
  badgeClass: string;
}> = {
  account_inactive: {
    label: "계정 비활성",
    detail: "사용자 계정을 활성화한 뒤 인계를 다시 확인하세요.",
    stage: 0,
    badgeClass: s.badgeInactive,
  },
  password_setup_required: {
    label: "비밀번호 설정 필요",
    detail: "임시 비밀번호를 설정해야 대표자가 처음 로그인할 수 있습니다.",
    stage: 0,
    badgeClass: styles.dangerBadge,
  },
  first_login_pending: {
    label: "최초 로그인 대기",
    detail: "대표자가 로그인해 본인 비밀번호로 변경하면 완료됩니다.",
    stage: 1,
    badgeClass: styles.warningBadge,
  },
  complete: {
    label: "인계 완료",
    detail: "대표자의 최초 비밀번호 변경이 완료되었습니다.",
    stage: 2,
    badgeClass: s.badgeActive,
  },
};

const OWNER_HANDOFF_PRIORITY: Record<TenantOwnerHandoffStatus, number> = {
  account_inactive: 0,
  password_setup_required: 1,
  first_login_pending: 2,
  complete: 3,
};

function OwnerHandoffBadge({ owner }: { owner: TenantOwnerDto }) {
  const copy = OWNER_HANDOFF_COPY[ownerHandoffStatus(owner)];
  return <span className={`${s.badge} ${copy.badgeClass}`}>{copy.label}</span>;
}

function OwnerHandoffOverview({
  owners,
  primaryDomain,
  isRefreshing,
  onRefresh,
  onPasswordSetup,
}: {
  owners: TenantOwnerDto[];
  primaryDomain: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onPasswordSetup: (owner: TenantOwnerDto) => void;
}) {
  if (!owners.length) return null;

  const completeCount = owners.filter((owner) => ownerHandoffStatus(owner) === "complete").length;
  const pendingOwner = [...owners]
    .filter((owner) => ownerHandoffStatus(owner) !== "complete")
    .sort((left, right) => (
      OWNER_HANDOFF_PRIORITY[ownerHandoffStatus(left)]
      - OWNER_HANDOFF_PRIORITY[ownerHandoffStatus(right)]
    ))[0] ?? null;
  const status = pendingOwner ? ownerHandoffStatus(pendingOwner) : "complete";
  const copy = OWNER_HANDOFF_COPY[status];
  const ownerLabel = pendingOwner?.name || pendingOwner?.username || "대표자";
  const loginUrl = primaryDomain ? `https://${primaryDomain}/login` : null;

  return (
    <section
      className={`${styles.handoffOverview} ${status === "complete" ? styles.handoffOverviewComplete : ""}`}
      aria-labelledby="owner-handoff-title"
    >
      <div className={styles.handoffSummary}>
        <p className={styles.handoffEyebrow}>OWNER HANDOFF</p>
        <h4 id="owner-handoff-title" className={styles.handoffTitle}>
          {pendingOwner ? `인계 대기 ${owners.length - completeCount}명` : "모든 소유자 인계 완료"}
        </h4>
        <p className={styles.handoffDescription}>
          {pendingOwner ? `${ownerLabel}: ${copy.detail}` : `${completeCount}명 모두 최초 비밀번호 변경을 마쳤습니다.`}
        </p>
      </div>

      <div className={styles.handoffProgress} aria-label={`인계 ${copy.stage}/2단계 완료`}>
        <span className={`${styles.handoffStep} ${copy.stage >= 1 ? styles.handoffStepDone : ""}`}>
          <span className={styles.handoffStepMark}>1</span>
          계정 준비
        </span>
        <span className={`${styles.handoffConnector} ${copy.stage >= 2 ? styles.handoffConnectorDone : ""}`} />
        <span className={`${styles.handoffStep} ${copy.stage >= 2 ? styles.handoffStepDone : ""}`}>
          <span className={styles.handoffStepMark}>2</span>
          본인 비밀번호 변경
        </span>
      </div>

      <div className={styles.handoffActions}>
        {pendingOwner && status === "password_setup_required" && (
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
            onClick={() => onPasswordSetup(pendingOwner)}
          >
            임시 비밀번호 설정
          </button>
        )}
        {pendingOwner && status === "first_login_pending" && loginUrl && (
          <a
            href={loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
          >
            대표자 로그인 열기 ↗
          </a>
        )}
        <button
          type="button"
          className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`}
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? "확인 중..." : "상태 새로고침"}
        </button>
      </div>
    </section>
  );
}

export function TenantOwnersTab({
  tenantId,
  tenantName,
  primaryDomain,
}: {
  tenantId: number;
  tenantName: string;
  primaryDomain: string | null;
}) {
  const navigate = useNavigate();
  const { data: owners, isLoading, isError, isFetching, refetch } = useTenantOwners(tenantId);
  const registerOwner = useRegisterOwner();
  const impersonate = useImpersonate();
  const updateOwner = useUpdateOwner();
  const resetOwnerPassword = useResetOwnerPassword();
  const removeOwner = useRemoveOwner();
  const { toast } = useDevToast();

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const resetOwner = owners?.find((owner) => owner.userId === resetId) ?? null;

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
    if (newPw && (newPw.length < 4 || newPw.length > 128)) {
      toast("신규 계정 임시 비밀번호는 4~128자로 입력해주세요.", "error");
      return;
    }
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

  function closePasswordReset() {
    setResetId(null);
    setResetPassword("");
    setResetPasswordConfirm("");
  }

  async function handlePasswordReset() {
    if (!resetOwner) return;
    if (resetPassword.length < 4 || resetPassword.length > 128) {
      toast("임시 비밀번호는 4~128자로 입력해주세요.", "error");
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      toast("임시 비밀번호 확인이 일치하지 않습니다.", "error");
      return;
    }
    try {
      await resetOwnerPassword.mutateAsync({
        tenantId,
        userId: resetOwner.userId,
        password: resetPassword,
      });
      toast("임시 비밀번호를 설정했습니다. 대상자는 첫 로그인에서 새 비밀번호로 변경해야 합니다.");
      closePasswordReset();
    } catch (error: unknown) {
      toast(tenantOwnerErrorMessage(error), "error");
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
                <input className={s.input} type="password" minLength={4} maxLength={128} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
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
              신규 계정이면 4~128자의 임시 비밀번호가 필수입니다. 기존 계정이면 아이디만 확인한 뒤 별도 승격 확인을 거치며, 기존 비밀번호와 프로필은 변경하지 않습니다.
            </p>
            <div className={styles.ownerFormActions}>
              <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={resetAddForm}>취소</button>
              <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} onClick={handleAdd} disabled={registerOwner.isPending}>
                {registerOwner.isPending ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        )}

        <OwnerHandoffOverview
          owners={owners ?? []}
          primaryDomain={primaryDomain}
          isRefreshing={isFetching}
          onRefresh={() => void refetch()}
          onPasswordSetup={(owner) => {
            setResetId(owner.userId);
            setResetPassword("");
            setResetPasswordConfirm("");
          }}
        />

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
                          <OwnerHandoffBadge owner={o} />
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
                          <OwnerHandoffBadge owner={o} />
                          <span className={styles.handoffRowDetail}>
                            {OWNER_HANDOFF_COPY[ownerHandoffStatus(o)].detail}
                          </span>
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
                                await activateImpersonation(r.access, r.refresh);
                                navigate("/workspace", { replace: true });
                                window.location.reload();
                              } catch (e: unknown) {
                                abortImpersonation();
                                const err = e as { response?: { data?: { detail?: string } } };
                                window.alert("임퍼소네이션 실패: " + (err.response?.data?.detail || String(e)));
                              }
                            }}
                            title="운영 확인을 위해 이 사용자로 로그인 (감사 로그 기록)"
                          >
                            운영 로그인
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
                            className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                            onClick={() => {
                              setResetId(o.userId);
                              setResetPassword("");
                              setResetPasswordConfirm("");
                            }}
                            disabled={o.isActive === false || resetOwnerPassword.isPending}
                            title={o.isActive === false ? "비활성 계정은 비밀번호를 초기화할 수 없습니다." : "기존 세션을 종료하고 임시 비밀번호 설정"}
                          >
                            비밀번호 재설정
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

        {resetOwner && (
          <section className={styles.ownerPasswordPanel} aria-labelledby="owner-password-reset-title">
            <div>
              <h4 id="owner-password-reset-title" className={styles.ownerPasswordTitle}>
                {resetOwner.name || resetOwner.username} 임시 비밀번호 설정
              </h4>
              <p className={styles.ownerFormHint}>
                저장하면 기존 로그인은 종료되고, 대상자는 다음 로그인에서 본인 비밀번호로 변경해야 합니다.
              </p>
            </div>
            <div className={styles.ownerPasswordFormGrid}>
              <div>
                <label className={s.inputLabel} htmlFor="owner-reset-password">임시 비밀번호</label>
                <input
                  id="owner-reset-password"
                  className={s.input}
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />
              </div>
              <div>
                <label className={s.inputLabel} htmlFor="owner-reset-password-confirm">임시 비밀번호 확인</label>
                <input
                  id="owner-reset-password-confirm"
                  className={s.input}
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  value={resetPasswordConfirm}
                  onChange={(event) => setResetPasswordConfirm(event.target.value)}
                />
              </div>
            </div>
            <div className={styles.ownerFormActions}>
              <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`} onClick={closePasswordReset} disabled={resetOwnerPassword.isPending}>
                취소
              </button>
              <button type="button" className={`${s.btn} ${s.btnDanger} ${s.btnSm}`} onClick={handlePasswordReset} disabled={resetOwnerPassword.isPending || !resetPassword || !resetPasswordConfirm}>
                {resetOwnerPassword.isPending ? "설정 중..." : "임시 비밀번호 설정"}
              </button>
            </div>
          </section>
        )}
      </div>

      <div className={styles.ownerNotice}>
        이 계정은 <strong>{tenantName}</strong> 전용입니다. 다른 테넌트에서는 로그인할 수 없습니다.
      </div>
    </>
  );
}
