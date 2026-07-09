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
      <div className={styles.memoSlot}>내 안내문이 들어가는 곳</div>
    </div>
  );
}

export function AlimtalkEnvelopeGuide({ variant = "full" }: GuideProps) {
  return (
    <div className={styles.guide} data-variant={variant}>
      <section className={styles.panel} aria-label="알림톡 자동발송 안내">
        <div className={styles.labelRow}>
          <span className={styles.labelIcon}><MessageSquareText size={18} /></span>
          <div>
            <div className={styles.eyebrow}>알림톡 자동발송</div>
            <div className={styles.title}>상황별로 어떤 안내문이 나가는지 확인하세요</div>
          </div>
        </div>
        <p className={styles.bodyText}>
          출결·성적·클리닉처럼 자주 쓰는 상황은 정해진 알림톡 형식으로 발송됩니다.
          선생님은 필요한 안내문만 고르고 수정하면 됩니다.
        </p>
        <div className={styles.flow}>
          <div className={styles.flowStep}>
            <strong>상황</strong>
            <span>가입·출결·성적·클리닉</span>
          </div>
          <div className={styles.flowStep}>
            <strong>알림톡</strong>
            <span>상황에 맞는 형식 자동 선택</span>
          </div>
          <div className={styles.flowStep}>
            <strong>안내문</strong>
            <span>저장한 문구 사용</span>
          </div>
          <div className={styles.flowStep}>
            <strong>발송</strong>
            <span>학생·학부모에게 전송</span>
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
        <section className={styles.routePanel} aria-label="알림톡 자동발송 매칭">
          <div className={styles.labelRow}>
            <span className={styles.labelIcon}><Boxes size={18} /></span>
            <div>
              <div className={styles.eyebrow}>상황별 발송 안내</div>
              <div className={styles.title}>어떤 상황에서 어떤 안내문이 나가는지 보여줍니다</div>
            </div>
          </div>
          <div className={styles.routeList}>
            <div className={styles.routeItem}>
              <span className={styles.routeLabel}>성적</span>
              <span className={styles.routeValue}>성적표 안내 알림톡</span>
            </div>
            <div className={styles.routeItem}>
              <span className={styles.routeLabel}>출결·시험·과제</span>
              <span className={styles.routeValue}>출석 안내 알림톡</span>
            </div>
            <div className={styles.routeItem}>
              <span className={styles.routeLabel}>클리닉</span>
              <span className={styles.routeValue}>클리닉 안내 또는 일정 변경 알림톡</span>
            </div>
            <div className={styles.routeItem}>
              <span className={styles.routeLabel}>퇴원·결제</span>
              <span className={styles.routeValue}>정해진 안내문으로 발송</span>
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
            자동발송 준비 중
          </div>
          <div className={styles.triggerMeta}>
            {fallbackTrigger || templateName || "이 항목"}은 사용할 알림톡 형식이 준비되면 발송할 수 있습니다.
          </div>
        </div>
        <div className={styles.memoPreview}>
          <div className={styles.memoPreviewLabel}>발송 상태</div>
          <div className={`${styles.memoPreviewBody} ${styles.fixedMemo}`}>아직 자동 발송하지 않음</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.triggerEnvelope}>
      <div>
        <div className={styles.triggerTitle}>
          <Send size={14} />
          알림톡 형식 {getAlimtalkTemplateLabel(normalized)}
          <span className={styles.prefix}>{spec.prefix}</span>
        </div>
        <div className={styles.slotList}>
          {spec.autoSlots.map((slot) => (
            <span key={slot} className={styles.slot}>{slot}</span>
          ))}
        </div>
        <div className={styles.triggerMeta}>
          {editable
            ? "저장한 안내문이 실제 알림톡 본문에 표시됩니다."
            : "정해진 안내문으로 발송됩니다."}
        </div>
      </div>
      <div className={styles.memoPreview}>
        <div className={styles.memoPreviewLabel}>
          {editable ? "저장된 안내문" : "고정 안내"}
        </div>
        <div className={`${styles.memoPreviewBody} ${editable ? "" : styles.fixedMemo}`}>
          {editable ? body?.trim() || "저장한 안내문이 여기에 보입니다." : "정해진 본문으로 발송"}
        </div>
      </div>
    </div>
  );
}
