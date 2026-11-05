import { useState } from "react";
import { getPresignedUrl } from "@/shared/api/contracts/storage";
import { surveyDate, surveyError, type SurveyResponse } from "@/shared/api/surveys";
import styles from "./Surveys.module.css";

export default function SurveyResponseContent({ response, studentId }: { response: SurveyResponse; studentId?: number }) {
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<number | null>(null);
  const openFile = async (id: number, key: string) => {
    setError(""); setOpening(id);
    try {
      const { url } = await getPresignedUrl(key, 300, studentId, true);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.rel = "noopener"; anchor.target = "_blank";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
    } catch (e) { setError(surveyError(e)); }
    finally { setOpening(null); }
  };
  return <div className={styles.answerBody}>
    <dl>{response.questions.map((question) => {
      const answer = response.answers[question.id];
      return <div key={question.id}><dt>{question.label}</dt><dd>{Array.isArray(answer) ? answer.join(", ") : answer ?? "응답 없음"}</dd></div>;
    })}</dl>
    {response.score_submissions.map((score) => <div key={score.id} className={styles.notice}>
      <strong>{score.subject} {score.score}/{score.max_score}점</strong><div>{score.label}</div>
      <span>{({ pending: "선생님 확인 대기", verified: "확인 후 통계 반영", rejected: "반영 보류", voided: "통계 제외" })[score.status]}</span>
      {score.review_note && <p>{score.review_note}</p>}
    </div>)}
    {response.attachments.map((file) => <div key={file.id} className={styles.fileRow}><span>{file.name}</span><button className={styles.button} type="button" disabled={opening === file.id} onClick={() => { void openFile(file.id, file.r2_key); }}>{opening === file.id ? "준비 중…" : "원본 내려받기"}</button></div>)}
    {error && <div role="alert" className={styles.error}>{error}</div>}
    <p className={styles.muted}>마지막 응답 {surveyDate(response.updated_at)}</p>
  </div>;
}
