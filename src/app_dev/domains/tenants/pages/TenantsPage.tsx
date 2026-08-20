import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { Search } from "lucide-react";
import { useTenantList, useCreateTenant, useUpdateTenant } from "@dev/domains/tenants/hooks/useTenants";
import { useDevToast } from "@dev/shared/components/useDevToast";
import s from "@dev/layout/DevLayout.module.css";
import styles from "./TenantsPage.module.css";

export default function TenantsPage() {
  const navigate = useNavigate();
  const { data: tenants, isLoading, isError, refetch } = useTenantList();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const { toast } = useDevToast();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // 생성 폼
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");

  const filtered = useMemo(() => {
    if (!tenants) return [];
    if (!search.trim()) return tenants;
    const q = search.trim().toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.primaryDomain && t.primaryDomain.toLowerCase().includes(q))
    );
  }, [tenants, search]);

  async function handleCreate() {
    if (createTenant.isPending) return;
    if (!newCode.trim() || !newName.trim()) {
      toast("코드와 이름을 입력해주세요.", "error");
      return;
    }
    try {
      const tenant = await createTenant.mutateAsync({
        code: newCode.trim(),
        name: newName.trim(),
        domain: newDomain.trim() || undefined,
      });
      toast(`${tenant.name} 기본 레코드 생성 완료. 운영 준비 후 소유자를 등록하세요.`);
      resetCreateForm();
      navigate(`/dev/tenants/${tenant.id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      const detail = err.response?.data?.detail;
      const messages: Record<string, string> = {
        code_invalid: "코드는 소문자 영문·숫자·하이픈만 사용할 수 있습니다.",
        name_invalid: "이름은 1~255자로 입력해주세요.",
        domain_invalid: "도메인은 포트 외 경로 없이 호스트만 입력해주세요.",
        tenant_code_conflict: "이미 사용 중인 테넌트 코드입니다.",
        tenant_domain_conflict: "이미 다른 테넌트가 사용 중인 도메인입니다.",
        tenant_provisioning_conflict: "동시 생성 충돌이 발생했습니다. 목록을 확인한 뒤 다시 시도해주세요.",
      };
      toast((detail && messages[detail]) || detail || "테넌트 생성에 실패했습니다.", "error");
    }
  }

  function resetCreateForm() {
    setShowCreate(false);
    setNewCode(""); setNewName(""); setNewDomain("");
  }

  async function handleToggleActive(id: number, currentlyActive: boolean) {
    try {
      await updateTenant.mutateAsync({ id, isActive: !currentlyActive });
      toast(currentlyActive ? "비활성화됨" : "활성화됨");
    } catch {
      toast("상태 변경 실패", "error");
    }
  }

  return (
    <>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <Link to="/dev/dashboard" className={styles.breadcrumbLink}>대시보드</Link>
          <span className={s.breadcrumbSep}>/</span>
          <span className={s.breadcrumbCurrent}>테넌트</span>
        </div>
      </header>

      <div className={s.content}>
        <div className={styles.toolbar}>
          <div className={`${s.pageHeader} ${styles.compactPageHeader}`}>
            <p className={s.pageEyebrow}>TENANT OPERATIONS</p>
            <h1 className={s.pageTitle}>테넌트 관리</h1>
            <p className={s.pageSub}>
              {isLoading ? "테넌트 경계를 확인하고 있습니다." : isError ? "목록 조회 실패 — 생성과 변경을 잠갔습니다." : `${tenants?.length ?? 0}개 테넌트의 계정·도메인·사용량을 관리합니다.`}
            </p>
          </div>
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary}`}
            onClick={() => setShowCreate(!showCreate)}
            disabled={isError}
          >
            + 새 테넌트
          </button>
        </div>

        {/* 생성 모달 */}
        {showCreate && (
          <div
            className={s.overlay}
            onClick={() => { if (!createTenant.isPending) resetCreateForm(); }}
          >
            <div
              className={s.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tenant-create-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={s.modalHeader}>
                <h2 id="tenant-create-title" className={s.modalTitle}>개발·QA 테넌트 기본 생성</h2>
                <p className={s.modalSub}>운영 온보딩 완료가 아닌 최소 기본 레코드만 생성합니다.</p>
              </div>
              <div className={`${s.modalBody} ${styles.modalFields}`}>
                <div className={styles.onboardingNotice} role="note">
                  <strong>운영 신규 테넌트는 이 폼으로 만들지 않습니다.</strong>
                  <span>코드·브랜딩 배포와 도메인·구독 감사를 먼저 마친 뒤, 테넌트 상세에서 소유자를 별도로 등록하세요.</span>
                </div>
                <div>
                  <label className={s.inputLabel} htmlFor="tenant-create-code">코드 *</label>
                  <input id="tenant-create-code" className={s.input} value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="qa-academy" disabled={createTenant.isPending} />
                </div>
                <div>
                  <label className={s.inputLabel} htmlFor="tenant-create-name">이름 *</label>
                  <input id="tenant-create-name" className={s.input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="QA 학원" disabled={createTenant.isPending} />
                </div>
                <div>
                  <label className={s.inputLabel} htmlFor="tenant-create-domain">도메인</label>
                  <input id="tenant-create-domain" className={s.input} value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="qa.example.com" disabled={createTenant.isPending} />
                </div>
              </div>
              <div className={s.modalFooter}>
                <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={resetCreateForm} disabled={createTenant.isPending}>취소</button>
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={handleCreate} disabled={createTenant.isPending}>
                  {createTenant.isPending ? "기본 레코드 생성 중..." : "기본 레코드 생성"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 검색 + 테이블 */}
        <div className={s.card}>
          <div className={s.cardHeader}>
            <div className={`${s.searchWrap} ${styles.searchWrap}`}>
              <span className={s.searchIcon}>
                <Search size={14} strokeWidth={1.5} />
              </span>
              <input
                className={s.searchInput}
                placeholder="테넌트 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className={s.cardBody}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`${s.skeleton} ${styles.skeletonRow}`} />
              ))}
            </div>
          ) : isError ? (
            <div className={s.empty} role="alert">
              <div className={s.emptyText}>테넌트 목록을 불러오지 못했습니다. 중복 생성을 막기 위해 생성 기능을 잠시 비활성화했습니다.</div>
              <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={() => void refetch()}>
                다시 시도
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className={s.empty}>
              <div className={s.emptyIcon}>🏢</div>
              <div className={s.emptyText}>
                {search ? "검색 결과가 없습니다." : "등록된 테넌트가 없습니다."}
              </div>
            </div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th className={styles.idColumn}>ID</th>
                  <th>이름</th>
                  <th>코드</th>
                  <th>도메인</th>
                  <th>상태</th>
                  <th className={styles.actionsColumn}>동작</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className={s.tableRow}
                    onClick={() => navigate(`/dev/tenants/${t.id}`)}
                  >
                    <td className={styles.mutedCell}>{t.id}</td>
                    <td className={styles.tenantNameCell}>{t.name}</td>
                    <td><span className={s.code}>{t.code}</span></td>
                    <td className={styles.domainCell}>{t.primaryDomain || "—"}</td>
                    <td>
                      <span className={`${s.badge} ${t.isActive ? s.badgeActive : s.badgeInactive}`}>
                        <span className={`${s.badgeDot} ${t.isActive ? s.badgeDotActive : s.badgeDotInactive}`} />
                        {t.isActive ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`${s.btn} ${s.btnSm} ${t.isActive ? s.btnDanger : s.btnPrimary}`}
                        disabled={updateTenant.isPending}
                        onClick={() => handleToggleActive(t.id, t.isActive)}
                      >
                        {t.isActive ? "비활성화" : "활성화"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
