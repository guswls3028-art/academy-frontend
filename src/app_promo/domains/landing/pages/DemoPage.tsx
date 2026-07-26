// PATH: src/app_promo/domains/landing/pages/DemoPage.tsx
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getPromoLeadErrorMessage, submitPromoDemoLead } from "../api/promoLead";
import { CONSULT_PHONE_DISPLAY } from "../business";
import LeadPrivacyConsent from "../components/LeadPrivacyConsent";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import { getPromoAttributionLabel } from "../promoAttribution";
import styles from "./LeadPage.module.css";

const INTEREST_OPTIONS = [
  "적중 매치업",
  "칠판용 PPT",
  "수강생 관리",
  "시험/과제",
  "자동채점·성적 관리",
  "학생앱 영상",
  "알림톡 발송",
  "보강/클리닉",
];

export default function DemoPage() {
  const [searchParams] = useSearchParams();
  const matchupPptRequested = searchParams.get("interest") === "matchup-ppt";
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [form, setForm] = useState({
    name: "",
    academy_name: "",
    phone: "",
    email: "",
    student_count: "",
    current_workflow: "",
    interests: matchupPptRequested ? ["적중 매치업", "칠판용 PPT"] : [] as string[],
    message: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleInterest = (item: string) =>
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(item)
        ? prev.interests.filter((i) => i !== item)
        : [...prev.interests, item],
    }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await submitPromoDemoLead({
        name: form.name,
        academyName: form.academy_name,
        phone: form.phone,
        email: form.email,
        studentCount: form.student_count,
        currentWorkflow: form.current_workflow,
        interests: form.interests,
        message: form.message,
        privacyAgreed,
        attribution: getPromoAttributionLabel(),
        website,
      });
      setSubmitted(true);
    } catch (err) {
      setError(getPromoLeadErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  if (submitted) {
    return (
      <section className={styles.resultSection}>
        <div className={styles.resultCard}>
          <span>데모 접수</span>
          <h1>데모 요청이 접수되었습니다</h1>
          <p>접수 내용을 확인한 뒤 연락드리겠습니다. 일정이 정해져 있으면 전화로 먼저 조율할 수 있습니다.</p>
          <div className={styles.resultActions}>
            <PhoneInquiryLink>전화 상담 {CONSULT_PHONE_DISPLAY}</PhoneInquiryLink>
            <Link to="/promo/pricing">요금제 보기</Link>
            <Link to="/promo/features">기능 소개 보기</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className={styles.hero} aria-labelledby="demo-title">
        <div className={styles.heroInner}>
          <span>데모 요청</span>
          <h1 id="demo-title">선생님의 수업 방식에 맞춰 데모를 준비합니다</h1>
          <p>데모 요청이나 전화 상담 후 사용할 기능과 시작일을 확인하고 계정을 설정합니다.</p>
          <PhoneInquiryLink>전화 상담 {CONSULT_PHONE_DISPLAY}</PhoneInquiryLink>
        </div>
      </section>

      <section className={styles.body}>
        <div className={styles.leadGrid}>
          <aside className={styles.sidePanel}>
            <span>데모에서 볼 내용</span>
            <h2>데모에서 확인할 내용</h2>
            <ol>
              <li>수업·시험·성적·메시지의 실제 화면</li>
              <li>월 요금, 별도 비용과 사용할 기능</li>
              <li>기존 자료 이전과 시작 일정</li>
            </ol>
            <div className={styles.callBox}>
              <strong>데모·가입 전화 상담</strong>
              <PhoneInquiryLink className={styles.callBoxButton}>{CONSULT_PHONE_DISPLAY}</PhoneInquiryLink>
              <p>사용할 기능과 시작일을 확인한 뒤 학원 계정을 설정합니다.</p>
            </div>
          </aside>

          <form onSubmit={handleSubmit} className={styles.formCard}>
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className={styles.honeypot}
            />

            <div className={styles.formGrid}>
              <label>
                <span>이름 *</span>
                <input
                  type="text"
                  required
                  maxLength={50}
                  disabled={pending}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="홍길동"
                />
              </label>
              <label>
                <span>소속/수업명 *</span>
                <input
                  type="text"
                  required
                  maxLength={80}
                  disabled={pending}
                  value={form.academy_name}
                  onChange={(e) => update("academy_name", e.target.value)}
                  placeholder="예: 홍길동영어, 고2 내신반"
                />
              </label>
              <label>
                <span>연락처 *</span>
                <input
                  type="tel"
                  required
                  maxLength={20}
                  disabled={pending}
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="010-0000-0000"
                />
              </label>
              <label>
                <span>이메일</span>
                <input
                  type="email"
                  maxLength={120}
                  disabled={pending}
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="example@email.com"
                />
              </label>
              <label>
                <span>담당 수강생 수</span>
                <input
                  type="text"
                  maxLength={40}
                  disabled={pending}
                  value={form.student_count}
                  onChange={(e) => update("student_count", e.target.value)}
                  placeholder="예: 50명"
                />
              </label>
              <label>
                <span>현재 수업 관리 방식</span>
                <input
                  type="text"
                  maxLength={120}
                  disabled={pending}
                  value={form.current_workflow}
                  onChange={(e) => update("current_workflow", e.target.value)}
                  placeholder="예: 수기 관리, 엑셀, 다른 학원 관리 프로그램"
                />
              </label>
            </div>

            <fieldset className={styles.choiceGroup}>
              <legend>관심 기능</legend>
              <div>
                {INTEREST_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={pending}
                    onClick={() => toggleInterest(opt)}
                    className={form.interests.includes(opt) ? styles.isSelected : ""}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className={styles.fullField}>
              <span>요청 사항</span>
              <textarea
                rows={4}
                maxLength={1500}
                disabled={pending}
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                placeholder="데모에서 꼭 보고 싶은 화면이나 채점/피드백 고민을 적어주세요."
              />
            </label>

            <LeadPrivacyConsent
              checked={privacyAgreed}
              disabled={pending}
              onChange={setPrivacyAgreed}
              requiredFields="이름, 소속/수업명, 연락처"
              optionalFields="이메일, 담당 수강생 수, 현재 수업 관리 방식, 관심 기능, 요청 사항, 유입 정보"
            />

            <p className={styles.formNotice}>
              시험지와 수업자료는 이 화면에 첨부하지 않습니다. 접수 후 자료를 안전하게 전달하는 방법을 안내합니다.
            </p>

            {error && <div className={styles.errorBox}>{error}</div>}

            <button type="submit" disabled={pending} className={styles.submitButton}>
              {pending ? "전송 중..." : "데모 요청하기"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
