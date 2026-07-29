import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Radio,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge, ICON } from "@/shared/ui/ds";
import styles from "./UpdatesPage.module.css";

type UpdateKind = "new" | "improve" | "fix";

type PublicUpdate = {
  id: string;
  date: string;
  title: string;
  summary: string;
  highlights: Array<{ kind: UpdateKind; text: string }>;
};

const KIND_META: Record<
  UpdateKind,
  { label: string; tone: "success" | "info" | "neutral"; icon: typeof Sparkles }
> = {
  new: { label: "새 기능", tone: "success", icon: Sparkles },
  improve: { label: "개선", tone: "info", icon: CheckCircle2 },
  fix: { label: "수정", tone: "neutral", icon: Wrench },
};

const PUBLIC_UPDATES: PublicUpdate[] = [
  {
    id: "2026-07-30",
    date: "2026-07-30",
    title: "처음 시작하는 계정 안내",
    summary:
      "새로 만든 계정이 로그인 직후 자신의 역할과 다음 이동 경로를 확인하고, 필요한 설정으로 바로 갈 수 있습니다.",
    highlights: [
      { kind: "new", text: "원장·관리자·선생님·직원·학생·학부모 역할별 첫 화면 안내" },
      { kind: "new", text: "내 역할에 맞는 설정과 업무 화면으로 바로 이동하는 버튼" },
      { kind: "improve", text: "안내 저장에 실패하면 완료 처리하지 않고 다시 시도할 수 있는 안전한 오류 상태" },
    ],
  },
  {
    id: "2026-07-29-teacher-tools",
    date: "2026-07-29",
    title: "선생님 도구함 Beta",
    summary:
      "수업 준비 중 막히는 문제를 입력하면 풀이와 설명 초안을 받아보고, 기존 도구와 함께 한곳에서 찾을 수 있습니다.",
    highlights: [
      { kind: "new", text: "선생님 업무 화면의 도구함과 문제 풀이·해설 Beta" },
      { kind: "improve", text: "입력 중 상태, 결과 없음, 재시도와 오류 안내를 같은 흐름으로 정리" },
      { kind: "fix", text: "테넌트와 권한 경계를 벗어난 요청은 결과를 만들지 않도록 차단" },
    ],
  },
  {
    id: "2026-07-29-grading",
    date: "2026-07-29",
    title: "시험 생성과 혼합 채점",
    summary:
      "선택형과 답변형이 섞인 시험을 만들고, OMR 결과를 보존하면서 필요한 문항만 직접 채점할 수 있습니다.",
    highlights: [
      { kind: "new", text: "선택형·답변형·혼합형 시험 생성과 문항별 직접 채점" },
      { kind: "new", text: "정오 입력, 부분점수, 결시와 복습 지정까지 한 표에서 확인" },
      { kind: "improve", text: "미리보기 후 전체 확정하며 다른 화면의 수정과 충돌하면 저장하지 않음" },
    ],
  },
  {
    id: "2026-07-29-score-operations",
    date: "2026-07-29",
    title: "성적 확인과 보정 기록",
    summary:
      "성적 입력 이후의 변경 이유와 추이를 더 분명하게 확인하고, 학생별 결과를 안정적으로 이어서 관리합니다.",
    highlights: [
      { kind: "new", text: "학생별 보정 메모와 점수 변화 추이 확인" },
      { kind: "improve", text: "성적 보고서와 화면의 합격·미달 판단 기준 통일" },
      { kind: "fix", text: "문항 표시 번호와 실제 저장 번호가 어긋나는 사례 수정" },
    ],
  },
  {
    id: "2026-07-27",
    date: "2026-07-27",
    title: "운영 문의함",
    summary:
      "버그 제보와 개선 의견을 비공개로 보내고, 답변과 처리 상태를 한곳에서 다시 확인할 수 있습니다.",
    highlights: [
      { kind: "new", text: "보낸 문의와 학원플러스 답변을 한 흐름에서 확인" },
      { kind: "new", text: "버그 제보·개선 의견에 이미지와 파일 첨부" },
      { kind: "improve", text: "문의별 처리 상태와 답변 대기 여부를 더 분명하게 표시" },
    ],
  },
];

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
            <span>Latest</span>
            <time dateTime={PUBLIC_UPDATES[0].date}>
              {formatDate(PUBLIC_UPDATES[0].date)}
            </time>
            <strong>{PUBLIC_UPDATES[0].title}</strong>
            <p>{PUBLIC_UPDATES[0].summary}</p>
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

          <ol className={styles.timeline}>
            {PUBLIC_UPDATES.map((update, index) => (
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
                    <time dateTime={update.date}>
                      <CalendarDays size={ICON.xs} aria-hidden="true" />
                      {formatDate(update.date)}
                    </time>
                  </div>
                  <h3>{update.title}</h3>
                  <p>{update.summary}</p>
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
