// PATH: src/app_teacher/domains/profile/pages/DesktopOnlyPage.tsx
// 모바일에서 정적 고급 업무를 찾아 canonical PC 화면으로 진입하는 허브
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import { ICON } from "@/shared/ui/ds";
import { BackButton, Card } from "@teacher/shared/ui/Card";
import { ChevronRight, Monitor, Search, Settings } from "@teacher/shared/ui/Icons";
import {
  useWorkspaceFeatures,
  WORKSPACE_FEATURE_CATEGORIES as CATEGORIES,
  WORKSPACE_FEATURE_CATEGORY_LABELS as CATEGORY_LABELS,
  WORKSPACE_FEATURE_ACCESS_LABELS as ACCESS_LABELS,
  type FeatureCategory,
} from "@/shared/ui/navigation/useWorkspaceFeatures";

import styles from "./DesktopOnlyPage.module.css";

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

export default function DesktopOnlyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | FeatureCategory>("all");

  const { features: visibleFeatures, hasWorkspaceAccess, permissionStatus, retryPermissions } = useWorkspaceFeatures();

  const filteredFeatures = useMemo(() => visibleFeatures.filter((feature) => {
    if (category !== "all" && feature.category !== category) return false;
    const terms = query.trim().split(/[\s,/]+/u).map(normalizeSearch).filter(Boolean);
    if (terms.length === 0) return true;
    const haystack = normalizeSearch([
      feature.title,
      feature.desc,
      CATEGORY_LABELS[feature.category],
      ...feature.keywords,
    ].join(" "));
    return terms.every((term) => haystack.includes(term));
  }), [category, query, visibleFeatures]);

  const groupedFeatures = CATEGORIES
    .filter((item): item is { key: FeatureCategory; label: string } => item.key !== "all")
    .map((item) => ({
      ...item,
      features: filteredFeatures.filter((feature) => feature.category === item.key),
    }))
    .filter((group) => group.features.length > 0);

  const openFullWorkspace = (path = "/workspace") => {
    setPreferFullWorkspace(true, { accountId: user?.id, mobileReturnPath: `${location.pathname}${location.search}` });
    navigate(path);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <BackButton onClick={() => navigate(-1)} />
        <div className={styles.headingGroup}>
          <h1 className={styles.title}>기능 찾기</h1>
          <p className={styles.eyebrow}>전체 업무 바로가기</p>
        </div>
      </div>

      <Card className={styles.leadCard}>
        <div className={styles.leadIcon} aria-hidden>
          <Monitor size={ICON.lg} />
        </div>
        <div className={styles.leadBody}>
          <p className={styles.leadTitle}>하고 싶은 업무로 바로 이동하세요</p>
          <p className={styles.leadText}>
            학생 복원, 급여, PPT처럼 필요한 업무를 찾아보세요. 선택한 기능의 상세 화면으로 이동하며 모바일 버전 버튼으로 돌아올 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openFullWorkspace()}
          className={styles.primaryButton}
        >
          <Monitor size={ICON.sm} /> PC 버전 홈
        </button>
      </Card>

      {permissionStatus && (
        <div className={styles.permissionNotice} role={permissionStatus === "error" ? "alert" : "status"}>
          {permissionStatus === "error" ? "권한 정보를 불러오지 못해 일부 관리 기능이 보이지 않습니다." : "관리 기능의 권한을 확인하고 있습니다."}
          {permissionStatus === "error" && <button type="button" onClick={() => void retryPermissions()}>다시 시도</button>}
        </div>
      )}
      {hasWorkspaceAccess ? (
        <>
          <div className={styles.finder}>
            <label className={styles.searchField}>
              <Search size={ICON.sm} aria-hidden />
              <span className={styles.srOnly}>전체 기능 검색</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="기능 또는 업무 검색"
                aria-label="전체 기능 검색"
              />
            </label>
            <div className={styles.categoryList} role="group" aria-label="기능 카테고리">
              {CATEGORIES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={item.key === category ? styles.categoryActive : styles.categoryButton}
                  aria-pressed={item.key === category}
                  onClick={() => setCategory(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <p className={styles.resultSummary} aria-live="polite">
            사용할 수 있는 기능 {filteredFeatures.length}개
          </p>

          {groupedFeatures.length > 0 ? (
            <div className={styles.groups}>
              {groupedFeatures.map((group) => (
                <section key={group.key} className={styles.group} aria-labelledby={`feature-${group.key}`}>
                  <div className={styles.groupHeading}>
                    <h2 id={`feature-${group.key}`}>{group.label}</h2>
                    <span>{group.features.length}</span>
                  </div>
                  <div className={styles.featureGrid}>
                    {group.features.map((feature) => {
                      const accessLabel = ACCESS_LABELS[feature.access];
                      return (
                        <button
                          key={feature.path}
                          type="button"
                          onClick={() => openFullWorkspace(feature.path)}
                          className={styles.featureButton}
                        >
                          <span className={styles.featureIcon}>{feature.icon}</span>
                          <span className={styles.featureBody}>
                            <span className={styles.featureTitleRow}>
                              <span className={styles.featureTitle}>{feature.title}</span>
                              {accessLabel && <span className={styles.accessBadge}>{accessLabel}</span>}
                            </span>
                            <span className={styles.featureDesc}>{feature.desc}</span>
                          </span>
                          <ChevronRight size={ICON.sm} className={styles.chevron} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState} role="status">
              <Search size={ICON.lg} aria-hidden />
              <strong>검색 결과가 없어요</strong>
              <span>다른 검색어를 입력하거나 전체 카테고리를 선택해 주세요.</span>
              <button type="button" onClick={() => { setQuery(""); setCategory("all"); }}>
                검색 초기화
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState} role="status">
          <Settings size={ICON.lg} aria-hidden />
          <strong>사용할 수 있는 PC 기능이 없어요</strong>
          <span>현재 계정의 학원 역할과 권한을 확인해 주세요.</span>
        </div>
      )}
    </div>
  );
}
