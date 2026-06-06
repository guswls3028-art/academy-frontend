import { Link } from "react-router-dom";
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
import styles from "./VideoPlatformPage.module.css";

const STUDENT_VISIBLE = [
  "학생전용앱에서 강의 목록 확인",
  "마지막으로 보던 지점부터 이어보기",
  "모바일/태블릿 플레이어, 배속, 전체화면",
  "영상별 댓글로 질문과 보충 설명 확인",
];

const TEACHER_VISIBLE = [
  "수강생별 미시청·시청중·완료 상태",
  "영상별 시청 시간과 마지막 재생 위치",
  "차시, 과제, 시험과 함께 확인",
  "필요한 학생에게 영상 시청 안내 발송",
];

const AUTO_MESSAGES = [
  { title: "입실·결석 알림", desc: "출결 처리와 동시에 학부모에게 상황을 안내합니다." },
  { title: "수업결과 알림톡", desc: "저장된 성적과 피드백으로 결과 안내를 보냅니다." },
  { title: "영상 시청 안내", desc: "영상을 안 본 학생에게 복습 안내를 보냅니다." },
];

export default function VideoPlatformPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="video-platform-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span>학생앱 영상</span>
            <h1 id="video-platform-title">수강생이 학생전용앱에서 이어서 보는 영상 학습</h1>
            <p>
              외부 링크만 보내는 방식이 아닙니다. 강의 목록, 이어보기, 댓글, 시청 이력을
              학생앱 안에서 함께 확인합니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/demo" className={styles.primaryButton}>
                데모 요청
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/features" className={styles.secondaryButton}>
                전체 기능 보기
              </Link>
            </div>
          </div>

          <div className={styles.heroScreens} aria-label="학생전용앱 영상 캡처">
            <figure className={`${styles.device} ${styles.deviceFront}`}>
              <img src="/promo/student-video-player.png" alt="학생전용앱 영상 플레이어 화면" />
            </figure>
            <figure className={styles.device}>
              <img src="/promo/student-video-list.png" alt="학생전용앱 영상 재생 목록 화면" />
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.screenEvidence} aria-labelledby="video-screens-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>실제 학생 화면</span>
            <h2 id="video-screens-title">학생이 보는 장면을 그대로 보여줍니다</h2>
            <p>
              영상 기능은 화면에서 흐름을 확인할 수 있습니다. 학생전용앱의 플레이어와 재생 목록을
              학부모에게도 쉽게 보여줄 수 있습니다.
            </p>
          </header>

          <div className={styles.evidenceGrid}>
            <figure className={`${styles.evidencePhone} ${styles.evidencePhoneLead}`}>
              <img src="/promo/student-video-player.png" alt="학생전용앱 영상 플레이어와 댓글 화면" loading="lazy" />
              <figcaption>학생전용앱 플레이어 · 댓글 · 이어보기</figcaption>
            </figure>
            <figure className={styles.evidencePhone}>
              <img src="/promo/student-video-list.png" alt="학생전용앱 영상 재생 목록 화면" loading="lazy" />
              <figcaption>재생 목록 · 시청 진도</figcaption>
            </figure>
            <figure className={styles.evidencePhone}>
              <img src="/promo/student-video-app.png" alt="학생전용앱 영상 강의 홈 화면" loading="lazy" />
              <figcaption>학생앱 강의 홈</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.proofSection} aria-labelledby="student-proof-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>복습 확인</span>
            <h2 id="student-proof-title">복습했는지 확인할 수 있어야 합니다</h2>
            <p>
              학생이 앱에서 복습 영상을 보고, 선생님이 시청 이력을 확인하면
              수업 뒤에 누굴 더 챙겨야 하는지 확인할 수 있습니다.
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
              <h2 id="video-workflow-title">영상만 올려두고 끝내지 않습니다</h2>
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
              <h2 id="video-alimtalk-title">알림톡 자동 발송은 반복 안내를 줄입니다</h2>
              <p>
                수업 후 결과 안내, 출결 확인, 영상 시청 안내를 매번 손으로 쓰지 않도록
                승인 템플릿과 발송 조건을 미리 잡아둡니다.
              </p>
            </div>
            <div className={styles.messageGrid}>
              {AUTO_MESSAGES.map((item) => (
                <article key={item.title}>
                  <BellRing size={18} />
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </article>
              ))}
            </div>
            <figure className={styles.alimtalkVisual}>
              <img src="/promo/admin-alimtalk-auto-send.png" alt="관리자 알림톡 자동 발송 설정 화면" loading="lazy" />
              <figcaption>관리자 자동 발송 설정 화면</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
