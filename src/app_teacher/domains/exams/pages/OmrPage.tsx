// PATH: src/app_teacher/domains/exams/pages/OmrPage.tsx
// OMR 관리 — 답안지 PDF 다운로드 + 카메라/파일로 스캔 업로드
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import { ChevronLeft, Download, Upload, Camera, Check } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { fetchOMRDefaults, downloadOMRPdf, submitOMR, fetchExam, fetchExamResults } from "../api";
import styles from "./OmrPage.module.css";

type TeacherExamResultRow = {
  id?: number | string | null;
  enrollment?: number | string | null;
  enrollment_id?: number | string | null;
  submitted_at?: string | null;
  total_score?: number | null;
  max_score?: number | null;
  student_name?: string | null;
  student?: { name?: string | null } | null;
};

export default function OmrPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const eid = Number(examId);
  const qc = useQueryClient();

  const [mcCount, setMcCount] = useState(20);
  const [essayCount, setEssayCount] = useState(0);
  const [nChoices, setNChoices] = useState(5);
  const [uploadTarget, setUploadTarget] = useState<number | null>(null);
  /** 업로드 후 자동 채점 진행 중인 enrollment 추적 — 결과 도착 시 자동 해제 */
  const [pendingScoring, setPendingScoring] = useState<Set<number>>(new Set());
  /** 무한 폴링 차단: enrollment_id별 시작 시각 (ms). 5분 후 강제 해제. */
  const pendingStartedAtRef = useRef<Map<number, number>>(new Map());

  const { data: exam } = useQuery({
    queryKey: ["teacher-exam", eid],
    queryFn: () => fetchExam(eid),
    enabled: Number.isFinite(eid),
  });

  const { data: defaults, isLoading } = useQuery({
    queryKey: ["teacher-omr-defaults", eid],
    queryFn: () => fetchOMRDefaults(eid),
    enabled: Number.isFinite(eid),
  });

  const { data: results } = useQuery({
    queryKey: ["teacher-exam-results", eid],
    queryFn: () => fetchExamResults(eid),
    enabled: Number.isFinite(eid),
    // 채점 대기 중이면 5초 폴링 — 결과 자동 갱신
    refetchInterval: pendingScoring.size > 0 ? 5000 : false,
  });
  const resultRows = useMemo(() => (results ?? []) as TeacherExamResultRow[], [results]);

  // 결과가 갱신되면 채점 완료된 enrollment를 pendingScoring에서 제거
  // + 5분 경과한 미완료 항목도 강제 해제 (백엔드 영구 실패 시 무한 폴링 차단)
  useEffect(() => {
    if (pendingScoring.size === 0) return;
    const TIMEOUT_MS = 5 * 60 * 1000;
    const now = Date.now();
    setPendingScoring((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const eid of prev) {
        const row = resultRows.find((r) => getEnrollmentId(r) === eid);
        const completed = !!(row && row.total_score != null);
        const startedAt = pendingStartedAtRef.current.get(eid) ?? now;
        const expired = now - startedAt > TIMEOUT_MS;
        if (completed || expired) {
          next.delete(eid);
          pendingStartedAtRef.current.delete(eid);
          changed = true;
          if (expired && !completed) {
            teacherToast.error("자동 채점이 시간 초과됐어요. 결과를 새로고침해 확인해 주세요.");
          }
        }
      }
      return changed ? next : prev;
    });
  }, [resultRows, pendingScoring]);

  const pendingCount = pendingScoring.size;

  useEffect(() => {
    if (defaults) {
      setMcCount(defaults.mc_count);
      setEssayCount(defaults.essay_count);
      setNChoices(defaults.n_choices);
    }
  }, [defaults]);

  const downloadMut = useMutation({
    mutationFn: () => downloadOMRPdf(eid, {
      exam_title: defaults?.exam_title ?? exam?.title,
      lecture_name: defaults?.lecture_name,
      session_name: defaults?.session_name,
      mc_count: mcCount,
      essay_count: essayCount,
      n_choices: nChoices,
    }),
    onSuccess: () => teacherToast.success("OMR PDF를 다운로드했습니다."),
    onError: () => teacherToast.error("다운로드에 실패했습니다."),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={`${styles.backButton} flex p-1 cursor-pointer`}
        >
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className={`${styles.title} text-[17px] font-bold flex-1 truncate`}>
          OMR · {defaults?.exam_title ?? exam?.title ?? "시험"}
        </h1>
      </div>

      {/* OMR 설정 */}
      <Card>
        <div className={`${styles.title} text-sm font-bold mb-2`}>OMR 답안지 설정</div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Fld label="객관식 문항 수" value={mcCount} onChange={setMcCount} />
            <Fld label="주관식 문항 수" value={essayCount} onChange={setEssayCount} />
          </div>
          <Fld label="객관식 선택지 수" value={nChoices} onChange={setNChoices} />
        </div>

        <button
          type="button"
          onClick={() => downloadMut.mutate()}
          disabled={downloadMut.isPending}
          className={`${styles.primaryActionButton} flex items-center justify-center gap-2 w-full text-sm font-bold cursor-pointer mt-3`}
        >
          <Download size={ICON.xs} /> {downloadMut.isPending ? "생성 중…" : "OMR PDF 다운로드"}
        </button>
      </Card>

      {/* 학생 제출 목록 */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className={`${styles.title} text-sm font-bold`}>스캔 업로드</div>
          {pendingCount > 0 && (
            <Badge tone="info" size="xs">자동 채점 중 {pendingCount}건</Badge>
          )}
        </div>
        <p className={`${styles.description} text-[11px] mb-3`}>
          학생별로 작성된 OMR을 카메라로 찍거나 갤러리에서 선택하여 업로드하면 자동 채점됩니다. 업로드 후 화면이 자동 갱신됩니다.
        </p>
        {resultRows.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {resultRows.map((r) => {
              const enrollmentId = getEnrollmentId(r);
              const hasSubmission = !!(r.submitted_at || r.total_score != null);
              const isScoring = enrollmentId != null && pendingScoring.has(enrollmentId) && r.total_score == null;
              return (
                <div key={r.id ?? enrollmentId} className={`${styles.resultRow} flex items-center justify-between`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`${styles.title} text-[13px] font-semibold`}>
                        {r.student_name ?? r.student?.name ?? "학생"}
                      </span>
                      {isScoring ? (
                        <Badge tone="info" size="xs">채점 중…</Badge>
                      ) : hasSubmission ? (
                        <Badge tone="success" size="xs"><Check size={9} /> 제출됨</Badge>
                      ) : null}
                    </div>
                    {r.total_score != null && (
                      <div className={`${styles.mutedText} text-[11px] mt-0.5`}>
                        점수: {r.total_score}/{r.max_score ?? 100}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (enrollmentId != null) setUploadTarget(enrollmentId);
                    }}
                    disabled={isScoring || enrollmentId == null}
                    className={`${styles.scanButton} flex items-center gap-1 text-[12px] font-bold cursor-pointer shrink-0`}
                  >
                    <Camera size={ICON.xs} /> 스캔
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState scope="panel" tone="empty" title="응시 학생이 없습니다" />
        )}
      </Card>

      {/* Upload modal */}
      <UploadSheet
        open={uploadTarget != null}
        onClose={() => setUploadTarget(null)}
        examId={eid}
        enrollmentId={uploadTarget}
        onSubmitted={(submittedEid) => {
          pendingStartedAtRef.current.set(submittedEid, Date.now());
          setPendingScoring((p) => new Set(p).add(submittedEid));
          // 즉시 1회 갱신 시도
          qc.invalidateQueries({ queryKey: ["teacher-exam-results", eid] });
        }}
      />
    </div>
  );
}

function UploadSheet({ open, onClose, examId, enrollmentId, onSubmitted }: {
  open: boolean; onClose: () => void; examId: number; enrollmentId: number | null;
  onSubmitted?: (enrollmentId: number) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const submitMut = useMutation({
    mutationFn: (file: File) => submitOMR(examId, { enrollment_id: enrollmentId!, file }),
    onSuccess: () => {
      teacherToast.success("스캔이 제출되었습니다. 자동 채점이 진행됩니다 (수 초 ~ 수십 초).");
      if (enrollmentId != null) onSubmitted?.(enrollmentId);
      onClose();
    },
    onError: (e: unknown) => teacherToast.error(getUploadErrorMessage(e)),
  });

  if (!open) return null;

  const pick = (fromCamera: boolean) => {
    const ref = fromCamera ? cameraRef : galleryRef;
    ref.current?.click();
  };

  return (
    <div className={`${styles.sheetBackdrop} fixed inset-0 z-40 flex items-end`} onClick={onClose}>
      <div
        className={`${styles.sheetPanel} w-full rounded-t-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className={`${styles.title} text-[16px] font-bold`}>OMR 스캔 업로드</div>
          <div className={`${styles.mutedText} text-[11px] mt-1`}>촬영 또는 갤러리에서 선택</div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => pick(true)}
            disabled={submitMut.isPending}
            className={`${styles.sheetPrimaryButton} flex items-center justify-center gap-2 text-sm font-bold cursor-pointer`}
          >
            <Camera size={ICON.xs} /> 카메라로 촬영
          </button>
          <button
            type="button"
            onClick={() => pick(false)}
            disabled={submitMut.isPending}
            className={`${styles.sheetSecondaryButton} flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer`}
          >
            <Upload size={ICON.xs} /> 갤러리에서 선택
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitMut.isPending}
            className={`${styles.sheetCancelButton} text-sm font-semibold cursor-pointer`}
          >
            취소
          </button>
        </div>

        {submitMut.isPending && (
          <div className={`${styles.mutedText} text-[12px] text-center mt-3`}>업로드 중…</div>
        )}

        {/* Hidden inputs */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className={styles.hiddenInput}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) submitMut.mutate(f); if (cameraRef.current) cameraRef.current.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*,application/pdf" className={styles.hiddenInput}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) submitMut.mutate(f); if (galleryRef.current) galleryRef.current.value = ""; }} />
      </div>
    </div>
  );
}

function Fld({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex-1">
      <label className={`${styles.mutedText} text-[11px] font-semibold block mb-1`}>{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`${styles.numberInput} w-full text-sm`} />
    </div>
  );
}

function getEnrollmentId(row: TeacherExamResultRow): number | null {
  const raw = row.enrollment ?? row.enrollment_id;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function getUploadErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : "업로드에 실패했습니다.";
}
