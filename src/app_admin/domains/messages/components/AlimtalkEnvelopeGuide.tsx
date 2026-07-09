import { Boxes, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import {
  EDITABLE_ALIMTALK_ENVELOPES,
  getAlimtalkEnvelopeSpec,
  getAlimtalkTemplateLabel,
  isAlimtalkTemplateBodyEditable,
  normalizeAlimtalkTemplateType,
  type AlimtalkTemplateType,
} from "../constants/alimtalkEnvelope";
import styles from "./AlimtalkEnvelopeGuide.module.css";

type GuideProps = {
  variant?: "full" | "compact";
};

function EnvelopeCard({ type }: { type: AlimtalkTemplateType }) {
  const spec = getAlimtalkEnvelopeSpec(type);
  if (!spec) return null;
  return (
    <div className={styles.envelopeCard}>
      <div className={styles.envelopeCardHeader}>
        <span className={styles.envelopeName}>{spec.label}</span>
        <span className={styles.prefix}>{spec.prefix}</span>
      </div>
      <div className={styles.slotList}>
        {spec.autoSlots.map((slot) => (
          <span key={slot} className={styles.slot}>{slot}</span>
        ))}
      </div>
      <div className={styles.memoSlot}>편지 영역 #{`{선생님메모}`}</div>
    </div>
  );
}

export function AlimtalkEnvelopeGuide({ variant = "full" }: GuideProps) {
  return (
    <div className={styles.guide} data-variant={variant}>
      <section className={styles.panel} aria-label="알림톡 봉투 구조">
        <div className={styles.labelRow}>
          <span className={styles.labelIcon}><MessageSquareText size={18} /></span>
          <div>
            <div className={styles.eyebrow}>알림톡 발송 구조</div>
            <div className={styles.title}>카카오 승인 봉투 안에 프로그램 템플릿을 넣어 보냅니다</div>
          </div>
        </div>
        <p className={styles.bodyText}>
          카카오가 고정한 제목·목록 항목은 봉투이고, 여기서 저장하는 본문은 발송 때
          #{`{선생님메모}`} 한 칸에 들어갑니다.
        </p>
        <div className={styles.flow}>
          <div className={styles.flowStep}>
            <strong>상황</strong>
            <span>가입·출결·성적·클리닉</span>
          </div>
          <div className={styles.flowStep}>
            <strong>봉투</strong>
            <span>성적표·출석·클리닉</span>
          </div>
          <div className={styles.flowStep}>
            <strong>편지</strong>
            <span>저장한 본문 → #{`{선생님메모}`}</span>
          </div>
          <div className={styles.flowStep}>
            <strong>발송</strong>
            <span>공용 승인 알림톡</span>
          </div>
        </div>
        {variant === "full" && (
          <div className={styles.envelopeGrid}>
            {EDITABLE_ALIMTALK_ENVELOPES.map((spec) => (
              <EnvelopeCard key={spec.type} type={spec.type} />
            ))}
          </div>
        )}
      </section>

      {variant === "full" && (
        <section className={styles.routePanel} aria-label="알림톡 봉투 매칭">
          <div className={styles.labelRow}>
            <span className={styles.labelIcon}><Boxes size={18} /></span>
            <div>
              <div className={styles.eyebrow}>상황별 봉투 매칭</div>
              <div className={styles.title}>사용자는 편지를 고치고, 시스템은 맞는 봉투를 고릅니다</div>
            </div>
          </div>
          <div className={styles.routeList}>
            <div className={styles.routeItem}>
              <span className={styles.routeLabel}>성적</span>
              <span className={styles.routeValue}>성적표 안내 봉투 + #{`{선생님메모}`}</span>
            </div>
            <div className={styles.routeItem}>
              <span className={styles.routeLabel}>출결·시험·과제</span>
              <span className={styles.routeValue}>출석 안내 봉투 + #{`{선생님메모}`}</span>
            </div>
            <div className={styles.routeItem}>
              <span className={styles.routeLabel}>클리닉</span>
              <span className={styles.routeValue}>클리닉 안내/일정 변경 봉투 + #{`{선생님메모}`}</span>
            </div>
            <div className={styles.routeItem}>
              <span className={styles.routeLabel}>퇴원·결제</span>
              <span className={styles.routeValue}>카카오 승인 고정 안내 봉투</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

type TriggerEnvelopeProps = {
  templateType?: string | null;
  fallbackTrigger?: string;
  body?: string;
  templateName?: string;
};

export function AlimtalkTriggerEnvelope({
  templateType,
  fallbackTrigger,
  body,
  templateName,
}: TriggerEnvelopeProps) {
  const normalized = normalizeAlimtalkTemplateType(templateType);
  const spec = getAlimtalkEnvelopeSpec(normalized);
  const editable = isAlimtalkTemplateBodyEditable(normalized);

  if (!spec) {
    return (
      <div className={styles.triggerEnvelope} data-missing="true">
        <div>
          <div className={styles.triggerTitle}>
            <ShieldCheck size={14} />
            공용 승인 봉투 연결 없음
          </div>
          <div className={styles.triggerMeta}>
            {fallbackTrigger || templateName || "이 항목"}은 같은 상황의 카카오 승인 봉투가 있을 때만 발송됩니다.
          </div>
        </div>
        <div className={styles.memoPreview}>
          <div className={styles.memoPreviewLabel}>발송 결과</div>
          <div className={`${styles.memoPreviewBody} ${styles.fixedMemo}`}>승인 봉투가 없으면 발송하지 않음</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.triggerEnvelope}>
      <div>
        <div className={styles.triggerTitle}>
          <Send size={14} />
          봉투 {getAlimtalkTemplateLabel(normalized)}
          <span className={styles.prefix}>{spec.prefix}</span>
        </div>
        <div className={styles.slotList}>
          {spec.autoSlots.map((slot) => (
            <span key={slot} className={styles.slot}>{slot}</span>
          ))}
        </div>
        <div className={styles.triggerMeta}>
          {editable
            ? `저장한 템플릿 본문이 #{선생님메모}에 들어갑니다.`
            : "카카오 승인 고정 본문으로 발송되어 별도 편지 영역이 없습니다."}
        </div>
      </div>
      <div className={styles.memoPreview}>
        <div className={styles.memoPreviewLabel}>
          {editable ? "편지 #{선생님메모}" : "고정 안내"}
        </div>
        <div className={`${styles.memoPreviewBody} ${editable ? "" : styles.fixedMemo}`}>
          {editable ? body?.trim() || "저장된 안내 문구가 여기에 들어갑니다." : "카카오 승인 본문 그대로 발송"}
        </div>
      </div>
    </div>
  );
}
