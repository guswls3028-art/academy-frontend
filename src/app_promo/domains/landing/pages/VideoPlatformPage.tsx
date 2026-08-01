import { Link } from "react-router";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  Eye,
  MessageSquareText,
  PlayCircle,
  Smartphone,
} from "lucide-react";
import CtaSection from "../components/CtaSection";
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import styles from "./VideoPlatformPage.module.css";

const STUDENT_VISIBLE = [
  "홈에서 오늘 수업과 할 일 확인",
  "영상 탭에서 수강 중인 강의 선택",
  "마지막으로 보던 지점부터 이어보기",
  "배속·전체화면·댓글 이용",
];

const TEACHER_VISIBLE = [
  "수강생별 미시청·시청중·완료 상태",
  "영상별 시청 시간과 마지막 재생 위치",
  "차시, 과제, 시험과 함께 확인",
  "필요한 학생에게 영상 시청 안내 발송",
];

const MESSAGE_CASES = [
  { title: "입실·결석 알림", desc: "설정된 출결 안내의 발송 상태를 화면에서 확인합니다." },
  { title: "수업결과 알림톡", desc: "저장된 성적과 피드백을 보고 내용을 확인한 뒤 보냅니다." },
  { title: "영상 시청 안내", desc: "미시청 학생을 고르고 복습 안내를 보냅니다." },
];

export default function VideoPlatformPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="video-platform-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span>학생앱 영상</span>
            <h1 id="video-platform-title">학생앱에서 복습 영상을 이어 봅니다</h1>
            <p>
              학생은 강의별 영상 목록, 이어보기와 댓글을 앱에서 이용합니다.
              선생님은 수강생별 시청 상태와 마지막 재생 위치를 확인할 수 있습니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/demo" className={styles.primaryButton}>
                데모 요청
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/features" className={styles.secondaryButton}>
                모든 기능 보기
              </Link>
            </div>
          </div>

          <div className={styles.heroScreens} aria-label="학생전용앱 영상 캡처">
            <figure className={`${styles.device} ${styles.deviceFront}`}>
              <PromoEvidenceImage
                src="/promo/student-video-player.webp"
                alt="학생전용앱 영상 플레이어 화면"
                width={780}
                height={1688}
              />
            </figure>
            <figure className={styles.device}>
              <PromoEvidenceImage
                src="/promo/student-app-home.webp"
                alt="학생전용앱 홈에서 오늘 할 일과 수업을 확인하는 화면"
                width={780}
                height={1688}
              />
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.screenEvidence} aria-labelledby="video-screens-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>실제 학생 화면</span>
            <h2 id="video-screens-title">홈에서 영상을 찾아 복습하는 과정입니다</h2>
            <p>
              학생은 홈에서 오늘 일정을 확인하고 영상 탭으로 이동합니다. 강의와 차시를 고른 뒤
              이어보기와 댓글을 이용합니다.
            </p>
          </header>

          <div className={styles.evidenceGrid}>
            <figure className={styles.evidencePhone}>
              <PromoEvidenceImage
                src="/promo/student-app-home.webp"
                alt="학생전용앱 홈에서 오늘 할 일과 수업을 확인하는 화면"
                width={780}
                height={1688}
                loading="lazy"
              />
              <figcaption>01 · 학생앱 홈</figcaption>
            </figure>
            <figure className={styles.evidencePhone}>
              <PromoEvidenceImage
                src="/promo/student-video-app.webp"
                alt="학생전용앱에서 수강 중인 영상 강의를 고르는 화면"
                width={780}
                height={1688}
                loading="lazy"
              />
              <figcaption>02 · 영상 강의 홈</figcaption>
            </figure>
            <figure className={styles.evidencePhone}>
              <PromoEvidenceImage
                src="/promo/student-video-list.webp"
                alt="학생전용앱에서 차시별 영상과 시청 진도를 확인하는 화면"
                width={780}
                height={1688}
                loading="lazy"
              />
              <figcaption>03 · 차시 재생 목록</figcaption>
            </figure>
            <figure className={styles.evidencePhone}>
              <PromoEvidenceImage
                src="/promo/student-video-player.webp"
                alt="학생전용앱 영상 플레이어와 선생님 댓글 화면"
                width={780}
                height={1688}
                loading="lazy"
              />
              <figcaption>04 · 플레이어와 댓글</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.proofSection} aria-labelledby="student-proof-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>복습 확인</span>
            <h2 id="student-proof-title">시청 기록은 선생님 화면에 남습니다</h2>
            <p>
              학생이 앱에서 영상을 보면 마지막 재생 위치와 완료 상태가 기록됩니다.
              선생님은 미시청 학생과 이어서 볼 학생을 확인할 수 있습니다.
            </p>
          </header>

          <div className={styles.twoColumn}>
            <article className={styles.featurePanel}>
              <div className={styles.panelIcon}>
                <Smartphone size={22} />
              </div>
              <h3>학생에게 보이는 것</h3>
              <ul>
                {STUDENT_VISIBLE.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className={styles.featurePanel}>
              <div className={styles.panelIcon}>
                <Eye size={22} />
              </div>
              <h3>선생님이 확인하는 것</h3>
              <ul>
                {TEACHER_VISIBLE.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.workflowSection} aria-labelledby="video-workflow-title">
        <div className={styles.sectionWrap}>
          <div className={styles.workflowLayout}>
            <div className={styles.workflowCopy}>
              <span>수업 후 안내</span>
              <h2 id="video-workflow-title">시청 상태를 확인하고 복습을 안내합니다</h2>
              <p>
                시청 상태가 남으면 아직 보지 않은 학생을 챙길 수 있습니다.
                필요한 경우 알림톡으로 복습 안내를 다시 보냅니다.
              </p>
            </div>
            <ol className={styles.routeList}>
              <li>
                <PlayCircle size={22} />
                <strong>영상 등록</strong>
                <p>차시별 복습 영상과 공개 대상을 정합니다.</p>
              </li>
              <li>
                <Clock3 size={22} />
                <strong>이어보기</strong>
                <p>학생은 마지막 재생 위치부터 다시 시작합니다.</p>
              </li>
              <li>
                <Eye size={22} />
                <strong>시청 이력</strong>
                <p>선생님은 미시청·완료 상태를 확인합니다.</p>
              </li>
              <li>
                <BellRing size={22} />
                <strong>알림톡 안내</strong>
                <p>필요한 학생과 학부모에게 후속 안내를 보냅니다.</p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.alimtalkSection} id="alimtalk" aria-labelledby="video-alimtalk-title">
        <div className={styles.sectionWrap}>
          <div className={styles.alimtalkBox}>
            <div className={styles.alimtalkCopy}>
              <span>
                <MessageSquareText size={17} />
                알림톡 발송
              </span>
              <h2 id="video-alimtalk-title">영상 안내 알림톡은 선생님이 확인해 보냅니다</h2>
              <p>
                미시청 학생을 확인하고 승인된 알림톡 양식에 안내 내용을 담습니다.
                대상과 선생님 메모는 발송 전에 최종 확인합니다.
              </p>
            </div>
            <div className={styles.messageGrid}>
              {MESSAGE_CASES.map((item) => (
                <article key={item.title}>
                  <BellRing size={18} />
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </article>
              ))}
            </div>
            <figure className={styles.alimtalkVisual}>
              <PromoEvidenceImage
                src="/promo/admin-alimtalk-auto-send.png"
                alt="관리자 알림톡 발송 설정 화면"
                width={1440}
                height={820}
                loading="lazy"
              />
              <figcaption>관리자 알림톡 발송 설정 화면</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
