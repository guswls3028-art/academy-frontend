/**
 * 시험 통계 학생 상세 드로어 — 우측 슬라이드 오버레이
 * 스크린샷 참고: 답안지/오답노트 탭, 스캔 결과, 선택형 답안(1~5 원형·정답/오답 표시), 서술형 답안, 총점
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "@/shared/ui/ds";
import CloseButton from "@/shared/ui/ds/CloseButton";
import { fetchAdminExamResultDetail, type ExamResultItem } from "../api/adminExamResultDetail";
import WrongNotePanel from "./WrongNotePanel";
import "./StudentResultDrawer.css";

const CHOICES = ["1", "2", "3", "4", "5"];

function isChoiceAnswer(a: string): boolean {
  const t = String(a ?? "").trim();
  return t === "1" || t === "2" || t === "3" || t === "4" || t === "5";
}

function getScanImageUrl(items: ExamResultItem[]): string {
  for (const it of items) {
    const m = it.meta;
    const candidates = [
      m?.omr?.image_url,
      m?.omr?.imageUrl,
      m?.image_url,
      m?.imageUrl,
      m?.omr?.page_image_url,
    ];
    const hit = candidates.find((v) => typeof v === "string" && v.length > 0);
    if (hit) return hit;
  }
  return "";
}

type Props = {
  examId: number;
  enrollmentId: number;
  studentName: string;
  examTitle: string;
  onClose: () => void;
};

export default function StudentResultDrawer({
  examId,
  enrollmentId,
  studentName,
  examTitle,
  onClose,
}: Props) {
  const [tab, setTab] = useState<"answer" | "wrong">("answer");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-exam-detail", examId, enrollmentId],
    queryFn: () => fetchAdminExamResultDetail(examId, enrollmentId),
    enabled: Number.isFinite(examId) && Number.isFinite(enrollmentId),
  });

  const choiceItems = useMemo(
    () => (data?.items ?? []).filter((it) => isChoiceAnswer(it.answer)),
    [data?.items]
  );
  const essayItems = useMemo(
    () => (data?.items ?? []).filter((it) => !isChoiceAnswer(it.answer)),
    [data?.items]
  );
  const scanImageUrl = useMemo(() => getScanImageUrl(data?.items ?? []), [data?.items]);

  return (
    <>
      <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />
      <div className="ds-overlay-wrap ds-overlay-wrap--drawer-right">
        <div
          className="ds-overlay-panel ds-overlay-panel--student-detail"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-result-drawer-title"
        >
          <CloseButton className="ds-overlay-panel__close" onClick={onClose} />

          <header className="ds-overlay-header" style={{ paddingRight: 48 }}>
            <div className="ds-overlay-header__inner">
              <div className="ds-overlay-header__title-block">
                <h1 id="student-result-drawer-title" className="ds-overlay-header__title">
                  {examTitle} 답안지 및 오답 확인
                </h1>
                <div className="ds-overlay-header__pills">
                  <span className="ds-badge ds-overlay-header__badge-id">{studentName}</span>
                </div>
              </div>
            </div>
          </header>

          <div className="ds-overlay-tabs">
            <Tabs
              value={tab}
              items={[
                { key: "answer", label: "답안지" },
                { key: "wrong", label: "오답노트" },
              ]}
              onChange={(k) => setTab(k as "answer" | "wrong")}
            />
          </div>

          <div className="ds-overlay-body" style={{ overflow: "auto" }}>
            {tab === "answer" && (
              <>
                {isLoading && (
                  <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                    상세 불러오는 중…
                  </div>
                )}
                {error && (
                  <div className="py-6 text-center text-sm text-[var(--color-error)]">
                    상세 조회 실패
                  </div>
                )}
                {data && !error && (
                  <div className="student-result-drawer__answer">
                    {/* 스캔 결과 */}
                    <section className="student-result-drawer__section">
                      <h3 className="student-result-drawer__section-title">스캔 결과</h3>
                      {scanImageUrl ? (
                        <div className="student-result-drawer__scan">
                          <img
                            src={scanImageUrl}
                            alt="답안지 스캔"
                            className="student-result-drawer__scan-img"
                          />
                          <div className="student-result-drawer__scan-actions">
                            <a
                              href={scanImageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="student-result-drawer__link"
                            >
                              새 창에서 보기
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          스캔 이미지가 없습니다.
                        </p>
                      )}
                    </section>

                    {/* 선택형 답안 */}
                    {choiceItems.length > 0 && (
                      <section className="student-result-drawer__section">
                        <h3 className="student-result-drawer__section-title">선택형 답안</h3>
                        <ul className="student-result-drawer__choice-list">
                          {choiceItems.map((it) => (
                            <ChoiceRow key={it.question_id} item={it} />
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* 서술형 답안 */}
                    {essayItems.length > 0 && (
                      <section className="student-result-drawer__section">
                        <h3 className="student-result-drawer__section-title">서술형 답안</h3>
                        <ul className="student-result-drawer__essay-list">
                          {essayItems.map((it) => (
                            <li key={it.question_id} className="student-result-drawer__essay-row">
                              <span className="student-result-drawer__essay-num">{it.question_id}번</span>
                              <span className="student-result-drawer__essay-answer">
                                {it.answer || "—"}
                              </span>
                              <span className="student-result-drawer__essay-score">
                                {it.score}/{it.max_score}점
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* 총점 */}
                    {data && (
                      <div className="student-result-drawer__total">
                        총점 : {data.total_score} / {data.max_score}점
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {tab === "wrong" && (
              <WrongNotePanel enrollmentId={enrollmentId} examId={examId} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ChoiceRow({ item }: { item: ExamResultItem }) {
  const studentChoice = String(item.answer ?? "").trim();
  return (
    <li className="student-result-drawer__choice-row">
      <span className="student-result-drawer__choice-num">{item.question_id}</span>
      <div className="student-result-drawer__choice-bubbles">
        {CHOICES.map((c) => {
          const isSelected = studentChoice === c;
          const isWrong = isSelected && !item.is_correct;
          return (
            <span key={c} className="student-result-drawer__bubble-wrap">
              <span
                className={`student-result-drawer__bubble ${
                  isSelected ? (item.is_correct ? "student-result-drawer__bubble--correct" : "student-result-drawer__bubble--wrong") : ""
                }`}
                aria-hidden
              >
                {c}
              </span>
              {isWrong && <span className="student-result-drawer__bubble-x" aria-hidden>✕</span>}
            </span>
          );
        })}
      </div>
    </li>
  );
}
