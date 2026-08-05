import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import useAuth from "@/auth/hooks/useAuth";

import { fetchLandingPublic } from "../api";
import { fetchMatchupShowcaseList, type MatchupShowcaseCard } from "../api/matchupShowcase";
import type { LandingPublicResponse } from "../types";
import { formatLandingYmdDateOrRaw as formatDate } from "../utils/dateFormat";
import { MatchupCenterSpin, MatchupCenterState, MatchupLandingShell } from "./LandingMatchupBoardShell";
import styles from "./LandingMatchupBoardPage.module.css";

export default function LandingMatchupBoardPage() {
  const [config, setConfig] = useState<LandingPublicResponse | null>(null);
  const [items, setItems] = useState<MatchupShowcaseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isOwner = Boolean(
    user?.is_superuser || user?.tenantRole === "owner" || user?.tenantRole === "admin",
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [landing, showcase] = await Promise.all([
        fetchLandingPublic(),
        fetchMatchupShowcaseList({ skipAuth: !user }),
      ]);
      setConfig(landing);
      setItems(showcase.results);
    } catch (requestError) {
      const detail = (requestError as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "자료 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  const cfg = config?.config;
  if (!cfg && loading) return <MatchupCenterSpin label="자료실을 불러오는 중..." />;

  if (!cfg) {
    return (
      <MatchupCenterState>
        <h1 className={styles.stateTitle}>자료실을 불러오지 못했습니다</h1>
        <p className={styles.stateCopy}>{error || "잠시 후 다시 확인해주세요."}</p>
        <Link className={styles.stateLink} to="/landing">홈으로 이동</Link>
      </MatchupCenterState>
    );
  }

  return (
    <MatchupLandingShell cfg={cfg}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <span className={styles.utility}>Tchul archive · matchup</span>
            <h1>매치업 자료실</h1>
            <p>
              수업 전에 준비한 자료와 실제 학교 시험을 비교해, 박철T가 직접 정리한 보고서를 공개합니다.
            </p>
          </div>
          {isOwner ? (
            <div className={styles.ownerActions}>
              <Link className={styles.uploadLink} to="/landing/admin/matchup-board?compose=upload">
                PDF 자료 올리기
                <UploadIcon />
              </Link>
              <Link className={styles.manageLink} to="/landing/admin/matchup-board">게시물 관리</Link>
            </div>
          ) : null}
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.contentBar}>
          <div>
            <strong>전체 자료</strong>
            <span>{loading ? "불러오는 중" : `${items.length}건`}</span>
          </div>
          <Link to="/landing/reports">자동 적중 분석 보기</Link>
        </div>

        {loading ? (
          <div className={styles.skeletonGrid} aria-label="자료를 불러오는 중">
            {[0, 1, 2].map((item) => <div className={styles.skeleton} key={item} />)}
          </div>
        ) : error ? (
          <div className={styles.notice} role="alert">
            <strong>자료를 표시하지 못했습니다.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void reload()}>다시 시도</button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.notice}>
            <strong>첫 매치업 자료를 준비하고 있습니다.</strong>
            <span>업로드가 완료되면 이곳에서 바로 확인할 수 있습니다.</span>
            {isOwner ? <Link to="/landing/admin/matchup-board?compose=upload">첫 PDF 올리기</Link> : null}
          </div>
        ) : (
          <div className={styles.archiveGrid}>
            {items.map((item, index) => (
              <ArchiveCard item={item} featured={index === 0} key={item.id} />
            ))}
          </div>
        )}
      </main>
    </MatchupLandingShell>
  );
}

function ArchiveCard({ item, featured }: { item: MatchupShowcaseCard; featured: boolean }) {
  const content = (
    <>
      <div className={styles.cardTop}>
        <span>{item.expired ? "공개 종료" : "PUBLIC PDF"}</span>
        <span>{formatDate(item.published_at)}</span>
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardType}>Matchup report</span>
        <h2>{item.title}</h2>
        <p>{item.description || "실제 시험과 사전 대비 자료를 비교한 매치업 보고서입니다."}</p>
      </div>
      <div className={styles.cardMeta}>
        <span>{item.snapshot_meta?.author_name || "박철T"}</span>
        <span>조회 {item.view_count}</span>
        <span className={styles.cardArrow}>{item.expired ? "기간 종료" : "자료 열기 →"}</span>
      </div>
    </>
  );

  const className = `${styles.card} ${featured ? styles.featured : ""} ${item.expired ? styles.expired : ""}`;
  if (item.visible && item.pdf_url) {
    return (
      <Link className={className} data-testid={`landing-matchup-card-${item.id}`} to={`/landing/matchup-board/${item.id}`}>
        {content}
      </Link>
    );
  }
  return <article className={className}>{content}</article>;
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 16V4m0 0-4 4m4-4 4 4M5 15v4h14v-4" />
    </svg>
  );
}
