import { Link } from "react-router";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Radio,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge, ICON } from "@/shared/ui/ds";
import {
  LATEST_PRODUCT_UPDATE,
  PRODUCT_UPDATE_CADENCE,
  PRODUCT_UPDATES,
  type ProductUpdateKind,
} from "@/shared/product/productUpdates";
import styles from "./UpdatesPage.module.css";

const KIND_META: Record<
  ProductUpdateKind,
  { label: string; tone: "success" | "info" | "neutral"; icon: typeof Sparkles }
> = {
  new: { label: "새 기능", tone: "success", icon: Sparkles },
  improve: { label: "개선", tone: "info", icon: CheckCircle2 },
  fix: { label: "수정", tone: "neutral", icon: Wrench },
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

export default function UpdatesPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="updates-title">
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <Radio size={ICON.xs} aria-hidden="true" />
              제품 업데이트
            </span>
            <h1 id="updates-title">
              실제 업무에서
              <br />
              달라진 점을 모았습니다
            </h1>
            <p>
              내부 기술 용어보다 선생님과 학생이 화면에서 체감하는 변화,
              사용할 수 있는 범위와 안전한 실패 동작을 먼저 설명합니다.
            </p>
            <div className={styles.heroActions}>
              <a href="#latest-update">
                최신 업데이트 보기
                <ArrowRight size={ICON.sm} aria-hidden="true" />
              </a>
              <Link to="/promo/features">전체 기능 보기</Link>
            </div>
          </div>

          <aside className={styles.latestSignal} aria-label="가장 최근 업데이트">
            <span>Latest release</span>
            <time dateTime={LATEST_PRODUCT_UPDATE.date}>
              {formatDate(LATEST_PRODUCT_UPDATE.date)}
            </time>
            <strong>{LATEST_PRODUCT_UPDATE.title}</strong>
            <p>{LATEST_PRODUCT_UPDATE.summary}</p>
            <div className={styles.latestScope}>
              <span>{LATEST_PRODUCT_UPDATE.availability}</span>
              <span>{LATEST_PRODUCT_UPDATE.audience.join(" · ")}</span>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.releaseSection} aria-labelledby="release-log-title">
        <div className={styles.sectionInner}>
          <header className={styles.sectionHead}>
            <div>
              <span>Release notes</span>
              <h2 id="release-log-title">업데이트 소식</h2>
            </div>
            <p>
              단계적으로 제공되는 기능은 해당 항목에 범위를 표시합니다.
              보이지 않는 기능은 문의하기에서 현재 계정의 제공 범위를 확인할 수 있습니다.
            </p>
          </header>

          <aside className={styles.cadenceBand} aria-label="업데이트 발행 일정">
            <div className={styles.cadenceIcon} aria-hidden>
              <Clock3 size={ICON.md} />
            </div>
            <div>
              <strong>{PRODUCT_UPDATE_CADENCE.dayLabel} {PRODUCT_UPDATE_CADENCE.timeLabel}</strong>
              <span>{PRODUCT_UPDATE_CADENCE.note} 긴급한 사용성 개선은 정기 발행일 전에도 안내합니다.</span>
            </div>
          </aside>

          <ol className={styles.timeline}>
            {PRODUCT_UPDATES.map((update, index) => (
              <li
                className={styles.release}
                id={index === 0 ? "latest-update" : update.id}
                key={update.id}
              >
                <div className={styles.rail} aria-hidden="true">
                  <span data-latest={index === 0 ? "true" : undefined} />
                </div>
                <article className={styles.releaseCard}>
                  <div className={styles.releaseMeta}>
                    {index === 0 && <Badge tone="info">최신</Badge>}
                    <span className={styles.availability}>{update.availability}</span>
                    <time dateTime={update.date}>
                      <CalendarDays size={ICON.xs} aria-hidden="true" />
                      {formatDate(update.date)}
                    </time>
                  </div>
                  <h3>{update.title}</h3>
                  <p>{update.summary}</p>
                  <div className={styles.audience} aria-label={`대상 ${update.audience.join(", ")}`}>
                    <span>대상</span>
                    {update.audience.map((audience) => <strong key={audience}>{audience}</strong>)}
                  </div>
                  <ul>
                    {update.highlights.map((highlight) => {
                      const meta = KIND_META[highlight.kind];
                      const KindIcon = meta.icon;
                      return (
                        <li key={highlight.text}>
                          <Badge tone={meta.tone}>
                            <KindIcon size={ICON.xs} aria-hidden="true" />
                            {meta.label}
                          </Badge>
                          <span>{highlight.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              </li>
            ))}
          </ol>

          <aside className={styles.contactBand}>
            <div>
              <span>도입·기능 문의</span>
              <h2>내 학원에서 사용할 수 있는지 확인해보세요</h2>
            </div>
            <Link to="/promo/contact">
              문의하기
              <ArrowRight size={ICON.sm} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
