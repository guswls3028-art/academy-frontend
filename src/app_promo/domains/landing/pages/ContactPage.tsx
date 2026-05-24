// PATH: src/app_promo/domains/landing/pages/ContactPage.tsx
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getPromoLeadErrorMessage, submitPromoContactLead } from "../api/promoLead";
import { CONSULT_PHONE_DISPLAY, CONSULT_PHONE_TEL } from "../business";
import styles from "./LeadPage.module.css";

const INQUIRY_TYPES = ["가격 문의", "데모 요청", "도입 상담", "기능 문의", "제휴 문의"];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    academy_name: "",
    student_count: "",
    inquiry_type: INQUIRY_TYPES[0],
    message: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await submitPromoContactLead({
        name: form.name,
        phone: form.phone,
        email: form.email,
        academyName: form.academy_name,
        studentCount: form.student_count,
        inquiryType: form.inquiry_type,
        message: form.message,
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
          <span>REQUEST RECEIVED</span>
          <h1>문의가 접수되었습니다</h1>
          <p>확인 후 빠르게 연락드리겠습니다. 급한 상담은 아래 번호로 바로 전화주세요.</p>
          <div className={styles.resultActions}>
            <a href={CONSULT_PHONE_TEL}>전화 상담 {CONSULT_PHONE_DISPLAY}</a>
            <Link to="/promo/pricing">요금제 보기</Link>
            <Link to="/promo">홈으로 돌아가기</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className={styles.hero} aria-labelledby="contact-title">
        <div className={styles.heroInner}>
          <span>CONTACT</span>
          <h1 id="contact-title">가격과 도입 범위를 정확히 확인하세요</h1>
          <p>폼 접수는 관리자 상담 수신함에 저장됩니다. 급한 일정이나 견적 확인은 전화가 가장 빠릅니다.</p>
          <a href={CONSULT_PHONE_TEL}>전화 상담 {CONSULT_PHONE_DISPLAY}</a>
        </div>
      </section>

      <section className={styles.body}>
        <div className={styles.leadGrid}>
          <aside className={styles.sidePanel}>
            <span>CONSULT NOTE</span>
            <h2>상담 전에 이 세 가지만 알려주세요</h2>
            <ol>
              <li>현재 학생 수와 관리자 수</li>
              <li>시험·과제·영상·메시지 중 필요한 범위</li>
              <li>도입 희망 일정과 기존 관리 방식</li>
            </ol>
            <div className={styles.callBox}>
              <strong>{CONSULT_PHONE_DISPLAY}</strong>
              <p>가격·일정·기능 범위가 급하면 바로 전화 상담 가능합니다.</p>
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
                <span>학원명</span>
                <input
                  type="text"
                  maxLength={80}
                  disabled={pending}
                  value={form.academy_name}
                  onChange={(e) => update("academy_name", e.target.value)}
                  placeholder="학원 이름"
                />
              </label>
              <label>
                <span>학생 수</span>
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
                <span>문의 유형 *</span>
                <select
                  required
                  disabled={pending}
                  value={form.inquiry_type}
                  onChange={(e) => update("inquiry_type", e.target.value)}
                >
                  {INQUIRY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className={styles.fullField}>
              <span>문의 내용 *</span>
              <textarea
                required
                rows={5}
                maxLength={1500}
                disabled={pending}
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                placeholder="궁금한 점이나 요청 사항을 자유롭게 작성해주세요."
              />
            </label>

            {error && <div className={styles.errorBox}>{error}</div>}

            <button type="submit" disabled={pending} className={styles.submitButton}>
              {pending ? "전송 중..." : "문의 보내기"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
