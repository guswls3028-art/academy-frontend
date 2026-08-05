import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

import {
  createWrongNotePDF,
  fetchWrongNotePDFStatus,
  fetchWrongNoteSources,
  previewSelectedWrongNotes,
  type WrongNoteSource,
  type WrongNoteSourceSelection,
} from "../api/wrongNotes";
import styles from "./StudentWrongNoteBuilder.module.css";

function sourceKey(source: WrongNoteSourceSelection): string {
  return `${source.type}:${source.id}:${source.enrollment_id}`;
}

export default function StudentWrongNoteBuilder({ studentId }: { studentId: number }) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [outputFormat, setOutputFormat] = useState<"pdf" | "hwpx">("pdf");
  const [jobId, setJobId] = useState<number | null>(null);
  const sourcesQuery = useQuery({
    queryKey: ["student-wrong-note-sources", studentId],
    queryFn: () => fetchWrongNoteSources(studentId),
    enabled: Number.isFinite(studentId) && studentId > 0,
  });
  const sourceData = sourcesQuery.data?.sources;
  const sources = useMemo(() => sourceData ?? [], [sourceData]);
  const selected = useMemo(
    () => sources
      .filter((source) => selectedKeys.has(sourceKey(source)))
      .map(({ type, id, enrollment_id }) => ({ type, id, enrollment_id })),
    [selectedKeys, sources],
  );
  const selectionToken = selected.map(sourceKey).join("|");

  useEffect(() => {
    setJobId(null);
  }, [selectionToken, outputFormat]);

  const preview = useQuery({
    queryKey: ["student-wrong-note-preview", studentId, selectionToken],
    queryFn: () => previewSelectedWrongNotes({
      student_id: studentId,
      source_selection: selected,
    }),
    enabled: selected.length > 0,
  });
  const create = useMutation({
    mutationFn: () => createWrongNotePDF({
      student_id: studentId,
      source_selection: selected,
      output_format: outputFormat,
      source_fingerprint: preview.data?.source_fingerprint,
    }),
    onSuccess: (job) => setJobId(job.job_id),
    onError: (error: unknown) => {
      feedback.error(extractApiError(error, "통합 오답노트 생성을 시작하지 못했습니다."));
    },
  });
  const job = useQuery({
    queryKey: ["wrong-note-document", jobId],
    queryFn: () => fetchWrongNotePDFStatus(Number(jobId)),
    enabled: jobId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "DONE" || status === "FAILED" ? false : 1_500;
    },
  });

  if (sourcesQuery.isLoading) {
    return <EmptyState scope="panel" tone="loading" title="오답노트 자료 불러오는 중…" />;
  }
  if (sourcesQuery.isError) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title="오답노트 자료를 불러오지 못했습니다."
        description={extractApiError(sourcesQuery.error, "잠시 후 다시 시도해 주세요.")}
      />
    );
  }

  const groups = Array.from(
    sources.reduce((map, source) => {
      const list = map.get(source.lecture_id) ?? [];
      list.push(source);
      map.set(source.lecture_id, list);
      return map;
    }, new Map<number, WrongNoteSource[]>()),
  );
  const previewGroups = Array.from(
    (preview.data?.results ?? []).reduce((map, item) => {
      const title = item.exam_title || "자료";
      const numbers = map.get(title) ?? [];
      if (item.question_number != null) numbers.push(item.question_number);
      map.set(title, numbers);
      return map;
    }, new Map<string, number[]>()),
  );
  const canCreate = Boolean(
    selected.length > 0
    && preview.data
    && preview.data.count > 0
    && preview.data.count <= 100,
  );

  return (
    <div className={styles.builder}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>학생별 통합 제작</span>
          <h2>시험과 워크북을 한 권으로</h2>
          <p>강의가 달라도 필요한 자료만 골라, 틀린 문항과 O·복습 문항을 한 번에 묶습니다.</p>
        </div>
        <div className={styles.heroCount} aria-label="선택 현황">
          <strong>{selected.length}</strong>
          <span>선택 자료</span>
          <i aria-hidden />
          <strong>{preview.data?.count ?? 0}</strong>
          <span>수록 문항</span>
        </div>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="오답노트로 묶을 자료가 없습니다."
          description="시험 채점을 완료하거나 과제에서 워크북 원본과 문항 표시를 등록해 주세요."
        />
      ) : (
        <div className={styles.workspace}>
          <section className={styles.sourceColumn} aria-labelledby="wrong-note-source-title">
            <div className={styles.columnHeader}>
              <h3 id="wrong-note-source-title">자료 선택</h3>
              <span>강의별</span>
            </div>
            <div className={styles.lectureList}>
              {groups.map(([lectureId, lectureSources]) => (
                <fieldset key={lectureId} className={styles.lectureGroup}>
                  <legend>{lectureSources[0]?.lecture_title || "강의"}</legend>
                  {lectureSources.map((source) => {
                    const key = sourceKey(source);
                    const disabled = !source.ready || source.wrong_note_count < 1;
                    return (
                      <label key={key} className={`${styles.sourceCard}${disabled ? ` ${styles.disabled}` : ""}`}>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          disabled={disabled}
                          onChange={(event) => {
                            setSelectedKeys((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(key);
                              else next.delete(key);
                              return next;
                            });
                          }}
                        />
                        <span className={styles.sourceType}>{source.type === "exam" ? "시험" : "워크북"}</span>
                        <span className={styles.sourceBody}>
                          <strong>{source.title}</strong>
                          <small>
                            {source.session_order != null ? `${source.session_order}회차 · ` : ""}
                            {source.ready ? `${source.wrong_note_count}문항` : "문항 검수 필요"}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          </section>

          <section className={styles.previewColumn} aria-labelledby="wrong-note-preview-title">
            <div className={styles.columnHeader}>
              <h3 id="wrong-note-preview-title">한 권 미리보기</h3>
              {preview.isFetching && <span>계산 중…</span>}
            </div>
            {selected.length === 0 ? (
              <div className={styles.previewEmpty}>왼쪽에서 시험이나 워크북을 선택해 주세요.</div>
            ) : preview.isError ? (
              <div className={styles.previewError} role="alert">
                {extractApiError(preview.error, "선택 자료를 미리 보지 못했습니다.")}
              </div>
            ) : (
              <div className={styles.previewBook}>
                <div className={styles.bookSpine} aria-hidden />
                <div className={styles.bookPage}>
                  <div className={styles.bookTitle}>통합 오답노트</div>
                  <p>틀린 문항 + 다시 볼 문항</p>
                  <div className={styles.previewGroups}>
                    {previewGroups.map(([title, numbers]) => (
                      <div key={title}>
                        <strong>{title}</strong>
                        <span>{numbers.map((number) => `${number}번`).join(" · ") || "문항"}</span>
                      </div>
                    ))}
                  </div>
                  {preview.data?.count === 0 && (
                    <div className={styles.previewEmpty}>선택한 자료에 수록할 문항이 없습니다.</div>
                  )}
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <div className={styles.formatChoice} role="group" aria-label="문서 형식">
                <button type="button" data-active={outputFormat === "pdf"} onClick={() => setOutputFormat("pdf")}>PDF</button>
                <button type="button" data-active={outputFormat === "hwpx"} onClick={() => setOutputFormat("hwpx")}>한글(HWPX)</button>
              </div>
              <Button
                type="button"
                intent="primary"
                loading={create.isPending || (jobId != null && !job.data)}
                disabled={!canCreate || job.data?.status === "PENDING" || job.data?.status === "RUNNING"}
                onClick={() => create.mutate()}
              >
                통합 오답노트 만들기
              </Button>
            </div>

            {preview.data && preview.data.count > 100 && (
              <p className={styles.limitWarning}>수록 문항이 100개를 넘습니다. 자료 선택을 줄여 주세요.</p>
            )}
            {job.data?.status === "FAILED" && (
              <p className={styles.previewError} role="alert">{job.data.error_message || "문서를 만들지 못했습니다."}</p>
            )}
            {job.data?.status === "DONE" && job.data.file_url && (
              <a className={styles.download} href={job.data.file_url} target="_blank" rel="noreferrer">
                완성된 {job.data.output_format === "hwpx" ? "한글" : "PDF"} 문서 열기
              </a>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
