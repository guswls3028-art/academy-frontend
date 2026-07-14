import { BellRing, PencilLine, Send, Settings, ShieldCheck } from "lucide-react";
import {
  getAlimtalkEnvelopeSpec,
  isAlimtalkTemplateBodyEditable,
  normalizeAlimtalkTemplateType,
} from "../constants/alimtalkEnvelope";
import styles from "./AlimtalkEnvelopeGuide.module.css";

type GuideProps = {
  variant?: "full" | "compact";
};

function ActionTile({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.actionTile}>
      <span className={styles.actionIcon}>{icon}</span>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

export function AlimtalkEnvelopeGuide({ variant = "full" }: GuideProps) {
  return (
    <div className={styles.guide} data-variant={variant}>
      <section className={styles.panel} aria-label="알림톡 사용 안내">
        <div className={styles.labelRow}>
          <span className={styles.labelIcon}><BellRing size={18} /></span>
          <div>
            <div className={styles.eyebrow}>알림톡</div>
            <div className={styles.title}>보내고, 켜고, 문구만 바꾸면 됩니다</div>
          </div>
        </div>
        <p className={styles.bodyText}>
          받을 사람과 보낼 시점을 정하고, 안내문만 원하는 내용으로 수정하세요.
        </p>
        <div className={styles.actionGrid} data-variant={variant}>
          <ActionTile icon={<Send size={14} />} title="알림톡 발송" text="학생·학부모에게 바로 보냅니다." />
          <ActionTile icon={<Settings size={14} />} title="자동발송 설정" text="필요한 알림톡만 켜고 끕니다." />
          <ActionTile icon={<PencilLine size={14} />} title="내용 수정" text="보낼 문구를 원하는 대로 바꿉니다." />
        </div>
      </section>
    </div>
  );
}

type TriggerEnvelopeProps = {
  templateType?: string | null;
  fallbackTrigger?: string;
  body?: string;
  templateName?: string;
  templateReady?: boolean;
  templateSource?: string;
};

export function AlimtalkTriggerEnvelope({
  templateType,
  fallbackTrigger,
  body,
  templateName,
  templateReady = false,
  templateSource,
}: TriggerEnvelopeProps) {
  const normalized = normalizeAlimtalkTemplateType(templateType);
  const spec = getAlimtalkEnvelopeSpec(normalized);
  const editable = isAlimtalkTemplateBodyEditable(normalized);

  if (!spec) {
    if (templateReady) {
      return (
        <div className={styles.triggerEnvelope} data-template-source={templateSource || "approved"}>
          <div>
            <div className={styles.triggerTitle}>
              <Send size={14} />
              승인된 전용 알림톡
              <span className={styles.templateBadge}>전용 양식</span>
            </div>
            <div className={styles.triggerMeta}>
              카카오 검수가 완료된 전용 양식으로 발송됩니다.
            </div>
          </div>
          <div className={styles.memoPreview}>
            <div className={styles.memoPreviewLabel}>발송 내용</div>
            <div className={`${styles.memoPreviewBody} ${styles.fixedMemo}`}>
              {body?.trim() || "정해진 본문으로 발송"}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.triggerEnvelope} data-missing="true">
        <div>
          <div className={styles.triggerTitle}>
            <ShieldCheck size={14} />
            발송 준비 필요
          </div>
          <div className={styles.triggerMeta}>
            {fallbackTrigger || templateName || "이 항목"}은 발송 준비가 끝난 뒤 사용할 수 있습니다.
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
            {editable ? "수정 가능한 알림톡" : "정해진 알림톡"}
            <span className={styles.templateBadge}>
              {editable ? "카카오 승인 공용 양식" : "카카오 승인 전용 양식"}
            </span>
          </div>
          <div className={styles.triggerMeta}>
            {editable
              ? `${fallbackTrigger || "이 알림"} 문구를 카카오 승인 공용 양식으로 보냅니다.`
              : `${fallbackTrigger || "이 알림"} 전용으로 승인된 내용이며 켜고 끄기만 할 수 있습니다.`}
          </div>
        </div>
      <div className={styles.memoPreview}>
        <div className={styles.memoPreviewLabel}>
          {editable ? "현재 문구" : "발송 내용"}
        </div>
        <div className={`${styles.memoPreviewBody} ${editable ? "" : styles.fixedMemo}`}>
          {editable ? body?.trim() || "저장한 안내문이 여기에 보입니다." : "정해진 본문으로 발송"}
        </div>
      </div>
    </div>
  );
}
