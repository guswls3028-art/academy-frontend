import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { getAccessToken } from "@/shared/api/axios";
import { submitUserIncident } from "@/shared/lib/userIncidentReporter";

const LOGIN_REQUIRED = "로그인이 필요해요. 다시 로그인해 주세요.";

type Props = {
  route: string;
  sentryEventId?: string;
  onClose: () => void;
  onReload?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
};

function failureMessage(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401) return LOGIN_REQUIRED;
  if (status === 403) return "제보 권한이 없어요. 로그인한 학원을 확인해 주세요.";
  if (status === 429) return "잠시 기다렸다 다시 보내 주세요.";
  return "제보를 보내지 못했어요. 다시 시도해 주세요.";
}

export default function BugReportForm({ route, sentryEventId, onClose, onReload, onSubmittingChange }: Props) {
  const fieldId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const receipt = useRef<HTMLHeadingElement>(null);
  const sending = useRef(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (submitted ? receipt : input).current?.focus();
  }, [submitted]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = description.trim();
    if (!message || sending.current) return;
    if (!getAccessToken()) {
      setError(LOGIN_REQUIRED);
      return;
    }

    sending.current = true;
    setSubmitting(true);
    onSubmittingChange?.(true);
    setError("");
    try {
      await submitUserIncident({
        source: "manual",
        message,
        route,
        sentryEventId,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
      });
      setSubmitted(true);
    } catch (cause) {
      setError(failureMessage(cause));
    } finally {
      sending.current = false;
      setSubmitting(false);
      onSubmittingChange?.(false);
    }
  }

  if (submitted) {
    return (
      <div className="error-recovery__receipt">
        <h2 ref={receipt} tabIndex={-1}>버그 제보가 접수됐어요</h2>
        <div className="error-recovery__actions">
          <button type="button" data-primary onClick={onReload ?? onClose}>
            {onReload ? "다시 불러오기" : "닫기"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="error-recovery__form" onSubmit={handleSubmit}>
      <label htmlFor={fieldId}>어떤 문제가 있었나요?</label>
      <textarea
        ref={input}
        id={fieldId}
        rows={4}
        maxLength={1000}
        value={description}
        readOnly={submitting}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="예: 검색 버튼을 누른 뒤 화면이 멈췄어요."
        aria-describedby={`${fieldId}-context`}
      />
      <div className="error-recovery__context">
        <span id={`${fieldId}-context`}>화면 정보가 함께 전송돼요. 개인정보는 적지 마세요.</span>
        <span>{description.length} / 1,000</span>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="error-recovery__actions">
        <button type="submit" data-primary disabled={submitting || !description.trim()}>
          <span role="status">{submitting ? "보내는 중…" : "제보 보내기"}</span>
        </button>
        <button type="button" onClick={onClose} disabled={submitting}>닫기</button>
      </div>
    </form>
  );
}
