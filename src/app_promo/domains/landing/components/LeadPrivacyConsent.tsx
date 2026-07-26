import { Link } from "react-router-dom";
import styles from "../pages/LeadPage.module.css";

type LeadPrivacyConsentProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  requiredFields?: string;
  optionalFields: string;
};

export default function LeadPrivacyConsent({
  checked,
  disabled = false,
  onChange,
  requiredFields = "이름, 연락처",
  optionalFields,
}: LeadPrivacyConsentProps) {
  return (
    <div className={styles.privacyConsent}>
      <div className={styles.privacySummary}>
        <strong>상담을 위한 개인정보 수집·이용 안내</strong>
        <dl>
          <div>
            <dt>목적</dt>
            <dd>데모·사용 문의 확인과 연락</dd>
          </div>
          <div>
            <dt>항목</dt>
            <dd>{requiredFields}(필수) / {optionalFields}(선택)</dd>
          </div>
          <div>
            <dt>보유</dt>
            <dd>상담 종료 또는 동의 철회 시까지. 관계 법령상 보관 의무가 있으면 해당 기간</dd>
          </div>
        </dl>
        <p>
          동의를 거부할 수 있으나, 필수 정보 수집에 동의하지 않으면 상담 요청을 접수할 수 없습니다.{" "}
          <Link to="/privacy" target="_blank" rel="noreferrer">
            개인정보처리방침 보기
          </Link>
        </p>
      </div>
      <label className={styles.privacyCheck}>
        <input
          type="checkbox"
          required
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>위 개인정보 수집·이용에 동의합니다. *</span>
      </label>
    </div>
  );
}
